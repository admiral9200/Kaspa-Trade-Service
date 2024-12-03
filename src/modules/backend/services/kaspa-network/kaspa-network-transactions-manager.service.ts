import { Injectable } from '@nestjs/common';
import { RpcService } from './rpc.service';
import {
  ICreateTransactions,
  IPaymentOutput,
  createTransactions,
  PrivateKey,
  Opcodes,
  addressFromScriptPublicKey,
  ScriptBuilder,
  IGeneratorSettingsObject,
  UtxoEntryReference,
  kaspaToSompi,
  PublicKey,
  verifyMessage,
  FeeSource,
  IFees,
  IUtxoEntry,
  PendingTransaction,
  IGetUtxosByAddressesResponse,
} from 'libs/kaspa/kaspa';
import { KRC20_BASE_TRANSACTION_AMOUNT, KRC20OperationDataInterface } from './classes/KRC20OperationData';
import { TransacionReciever } from './classes/TransacionReciever';
import { FeesCalculation } from './interfaces/FeesCalculation.interface';
import { PriorityFeeTooHighError } from './errors/PriorityFeeTooHighError';
import { Krc20TransactionsResult } from './interfaces/Krc20TransactionsResult.interface';
import { UtilsHelper } from '../../helpers/utils.helper';
import { TotalBalanceWithUtxosInterface } from './interfaces/TotalBalanceWithUtxos.interface';
import { NotEnoughBalanceError } from './errors/NotEnoughBalance';
import { KaspaNetworkConnectionManagerService } from './kaspa-network-connection-manager.service';
import { UtxoProcessorManager } from './classes/UnxoProcessorManager';
import { KaspaApiService } from '../kaspa-api/services/kaspa-api.service';
import { ApplicationIsClosingError } from './errors/ApplicationIsClosingError';
import { ImportantPromisesManager } from '../../important-promises-manager/important-promises-manager';

export const MINIMAL_AMOUNT_TO_SEND = kaspaToSompi('0.2');
const TIME_TO_WAIT_BEFORE_TRANSACTION_RECEIVED_CHECK = 120 * 1000;
const NUMBER_OF_MINUTES_TO_KEEP_CHECKING_TRANSACTION_RECEIVED = 25 * 12;

type DoTransactionOptions = {
  notifyCreatedTransactions?: (transactionId: string) => Promise<any>;
  specialSignTransactionFunc?: (transaction: PendingTransaction) => Promise<any>;
  additionalKrc20TransactionPriorityFee?: bigint;
  priorityEntries?: IUtxoEntry[];
  sendAll?: boolean;
  stopOnApplicationClosing?: boolean;
};

@Injectable()
export class KaspaNetworkTransactionsManagerService {
  constructor(
    private rpcService: RpcService,
    private readonly connectionManager: KaspaNetworkConnectionManagerService,
    private readonly utils: UtilsHelper,
    private readonly kaspaApiService: KaspaApiService,
  ) {}

  async signAndSubmitTransactions(transactionsData: ICreateTransactions, privateKey: PrivateKey): Promise<string[]> {
    const results: string[] = [];

    for (const transaction of transactionsData.transactions) {
      transaction.sign([privateKey]);
      const currentResult = await transaction.submit(this.rpcService.getRpc());
      results.push(currentResult);
    }

    return results;
  }

  createP2SHAddressScript(data: KRC20OperationDataInterface, privateKey: PrivateKey) {
    const script = new ScriptBuilder()
      .addData(privateKey.toPublicKey().toXOnlyPublicKey().toString())
      .addOp(Opcodes.OpCheckSig)
      .addOp(Opcodes.OpFalse)
      .addOp(Opcodes.OpIf)
      .addData(Buffer.from('kasplex'))
      .addI64(0n)
      .addData(Buffer.from(JSON.stringify(data)))
      .addOp(Opcodes.OpEndIf);

    const scriptAddress = addressFromScriptPublicKey(script.createPayToScriptHashScript(), this.rpcService.getNetwork());

    return {
      script: script,
      p2shaAddress: scriptAddress,
    };
  }

  async createTransaction(
    privateKey: PrivateKey,
    outputs: IPaymentOutput[],
    priorityFee: bigint = 0n,
    withoutRetry = false,
  ): Promise<ICreateTransactions> {
    const { entries } = await this.rpcService.getRpc().getUtxosByAddresses({
      addresses: [this.convertPrivateKeyToPublicKey(privateKey)],
    });

    const transactionData = {
      entries,
      outputs,
      changeAddress: this.convertPrivateKeyToPublicKey(privateKey),
      priorityFee: priorityFee,
      networkId: this.rpcService.getNetwork(),
      feeRate: 1.0,
    };

    let transactions = null;

    if (withoutRetry) {
      transactions = await createTransactions(transactionData);
    } else {
      transactions = await this.utils.retryOnError(async () => await createTransactions(transactionData));
    }

    return transactions;
  }

  async createKaspaTransferTransactionAndDo(
    privateKey: PrivateKey,
    payments: IPaymentOutput[],
    maxPriorityFee: bigint,
    sendAll = false,
  ): Promise<ICreateTransactions> {
    const walletUtxoInfo = await this.getWalletTotalBalanceAndUtxos(this.convertPrivateKeyToPublicKey(privateKey));

    if (sendAll) {
      if (walletUtxoInfo.totalBalance <= MINIMAL_AMOUNT_TO_SEND) {
        throw new NotEnoughBalanceError();
      }

      payments[0].amount =
        walletUtxoInfo.totalBalance > MINIMAL_AMOUNT_TO_SEND * 2n
          ? walletUtxoInfo.totalBalance / 2n
          : walletUtxoInfo.totalBalance - MINIMAL_AMOUNT_TO_SEND;
    }

    const transactionData: IGeneratorSettingsObject = {
      entries: walletUtxoInfo.utxoEntries,
      outputs: payments,
      changeAddress: this.convertPrivateKeyToPublicKey(privateKey),
      priorityFee: 0n,
      networkId: this.rpcService.getNetwork(),
      feeRate: 1.0,
    };

    const transactionsFees = await this.calculateTransactionFeeAndLimitToMax(transactionData, maxPriorityFee);
    transactionData.priorityFee = transactionsFees.priorityFee;

    console.log(`fees trans sum (${payments.length})`, transactionsFees);

    if (sendAll) {
      payments[0].amount = walletUtxoInfo.totalBalance - transactionsFees.maxFee;
    }

    return await this.utils.retryOnError(async () => {
      return await this.connectAndDo(async () => {
        const transferFundsTransaction = await createTransactions(transactionData);

        const transactionReciever = new TransacionReciever(
          this.rpcService.getRpc(),
          this.convertPrivateKeyToPublicKey(privateKey),
          transferFundsTransaction.summary.finalTransactionId,
          sendAll,
        );

        await transactionReciever.registerEventHandlers();

        console.log(`trans sum (${payments.length})`, transferFundsTransaction.summary);

        try {
          await this.signAndSubmitTransactions(transferFundsTransaction, privateKey);

          await transactionReciever.waitForTransactionCompletion();
        } catch (error) {
          throw error;
        } finally {
          await transactionReciever.dispose();
        }

        return transferFundsTransaction;
      }, 1);
    });
  }

  async calculateTransactionFeeAndLimitToMax(transactionData, maxPriorityFee): Promise<FeesCalculation> {
    const finalFees = await this.utils.retryOnError(async () => {
      const currentTransaction = await createTransactions(transactionData);

      // console.log('calculateTransactionFeeAndLimitToMax', currentTransaction.summary);

      const fees = await this.getTransactionFees(currentTransaction);

      return fees;
    });

    if (finalFees.priorityFee > maxPriorityFee) {
      throw new PriorityFeeTooHighError();
    }

    return finalFees;
  }

  async doKrc20CommitTransaction(
    privateKey: PrivateKey,
    krc20transactionData: KRC20OperationDataInterface,
    maxPriorityFee: bigint = 0n,
    baseTransactionAmount = KRC20_BASE_TRANSACTION_AMOUNT,
  ) {
    const scriptAndScriptAddress = this.createP2SHAddressScript(krc20transactionData, privateKey);

    const { entries } = await this.rpcService.getRpc().getUtxosByAddresses({
      addresses: [this.convertPrivateKeyToPublicKey(privateKey)],
    });

    const baseTransactionData: IGeneratorSettingsObject = {
      priorityEntries: [],
      entries,
      outputs: [
        {
          address: scriptAndScriptAddress.p2shaAddress.toString(),
          amount: baseTransactionAmount,
        },
      ],
      feeRate: 1.0,
      changeAddress: this.convertPrivateKeyToPublicKey(privateKey),
      priorityFee: 0n,
      networkId: this.rpcService.getNetwork(),
    };

    const { priorityFee } = await this.calculateTransactionFeeAndLimitToMax(baseTransactionData, maxPriorityFee);
    baseTransactionData.priorityFee = priorityFee;

    const commitTransaction = await this.utils.retryOnError(async () => {
      return await this.connectAndDo(async () => {
        const transaction = await createTransactions(baseTransactionData);

        const transactionReciever = new TransacionReciever(
          this.rpcService.getRpc(),
          this.convertPrivateKeyToPublicKey(privateKey),
          transaction.summary.finalTransactionId,
        );

        console.log('commit transaction summry', transaction.summary);

        await transactionReciever.registerEventHandlers();

        try {
          await this.signAndSubmitTransactions(transaction, privateKey);

          await transactionReciever.waitForTransactionCompletion();
        } catch (error) {
          throw error;
        } finally {
          await transactionReciever.dispose();
        }

        return transaction;
      }, 1);
    });

    return commitTransaction;
  }

  async doKrc20RevealTransaction(
    privateKey: PrivateKey,
    krc20transactionData: KRC20OperationDataInterface,
    transactionFeeAmount: bigint,
    maxPriorityFee: bigint = 0n,
  ) {
    const scriptAndScriptAddress = this.createP2SHAddressScript(krc20transactionData, privateKey);

    const { entries } = await this.rpcService.getRpc().getUtxosByAddresses({
      addresses: [this.convertPrivateKeyToPublicKey(privateKey)],
    });

    const revealUTXOs = await this.rpcService.getRpc().getUtxosByAddresses({
      addresses: [scriptAndScriptAddress.p2shaAddress.toString()],
    });

    const baseTransactionData: IGeneratorSettingsObject = {
      priorityEntries: [revealUTXOs.entries[0]],
      entries,
      outputs: [],
      feeRate: 1.0,
      changeAddress: this.convertPrivateKeyToPublicKey(privateKey),
      priorityFee: transactionFeeAmount,
      networkId: this.rpcService.getNetwork(),
    };

    const { priorityFee } = await this.calculateTransactionFeeAndLimitToMax(baseTransactionData, maxPriorityFee);
    baseTransactionData.priorityFee = transactionFeeAmount + priorityFee;

    const revealTransactions = await this.utils.retryOnError(async () => {
      return await this.connectAndDo(async () => {
        const currentTransactions = await createTransactions(baseTransactionData);

        for (const transaction of currentTransactions.transactions) {
          transaction.sign([privateKey], false);
          const ourOutput = transaction.transaction.inputs.findIndex((input) => input.signatureScript === '');

          if (ourOutput !== -1) {
            const signature = await transaction.createInputSignature(ourOutput, privateKey);

            transaction.fillInput(ourOutput, scriptAndScriptAddress.script.encodePayToScriptHashSignatureScript(signature));
          }

          const revealTransactionReciever = new TransacionReciever(
            this.rpcService.getRpc(),
            this.convertPrivateKeyToPublicKey(privateKey),
            currentTransactions.summary.finalTransactionId,
          );

          console.log('reveal transaction summry', currentTransactions.summary);

          await revealTransactionReciever.registerEventHandlers();

          try {
            await transaction.submit(this.rpcService.getRpc());

            await revealTransactionReciever.waitForTransactionCompletion();
          } catch (error) {
            throw error;
          } finally {
            await revealTransactionReciever.dispose();
          }
        }

        return currentTransactions;
      }, 1);
    });

    return revealTransactions;
  }

  // ================================================================
  // DO TRANSACTIONS WITH UTXOS PROCESSOR
  // ================================================================

  private async doTransactionWithUtxoProcessor(
    privateKey: PrivateKey,
    maxPriorityFee: bigint,
    outputs: IPaymentOutput[],
    additionalOptions: DoTransactionOptions = {},
  ) {
    const additionalKrc20TransactionPriorityFee = additionalOptions.additionalKrc20TransactionPriorityFee || 0n;
    const sendAll = additionalOptions.sendAll || false;
    let totalPaymentsAmount = outputs.reduce((previousValue, currentValue) => previousValue + currentValue.amount, 0n);

    return await this.connectAndDo<ICreateTransactions>(async () => {
      return await UtxoProcessorManager.useUtxoProcessorManager<ICreateTransactions>(
        this.rpcService.getRpc(),
        this.rpcService.getNetwork(),
        this.convertPrivateKeyToPublicKey(privateKey),
        async (context, utxoProcessonManager) => {
          if (sendAll) {
            await utxoProcessonManager.waitForPendingUtxoToFinish();
            const remeaingAmountToSend = context.balance.mature - (totalPaymentsAmount - outputs[0].amount);

            if (remeaingAmountToSend <= MINIMAL_AMOUNT_TO_SEND) {
              throw new NotEnoughBalanceError();
            }

            outputs[0].amount = remeaingAmountToSend;
            totalPaymentsAmount = outputs.reduce((previousValue, currentValue) => previousValue + currentValue.amount, 0n);
          } else {
            if (
              context.balance.mature < totalPaymentsAmount + additionalKrc20TransactionPriorityFee + MINIMAL_AMOUNT_TO_SEND &&
              context.balance.pending > 0n
            ) {
              await utxoProcessonManager.waitForPendingUtxoToFinish();
            }

            if (context.balance.mature < totalPaymentsAmount) {
              throw new NotEnoughBalanceError();
            }
          }

          const baseTransactionData: IGeneratorSettingsObject = {
            priorityEntries: additionalOptions.priorityEntries || [],
            entries: context,
            outputs,
            feeRate: 1.0,
            changeAddress: this.convertPrivateKeyToPublicKey(privateKey),
            priorityFee: {
              amount: additionalKrc20TransactionPriorityFee,
              source: sendAll ? FeeSource.ReceiverPays : FeeSource.SenderPays,
            },
            networkId: this.rpcService.getNetwork(),
          };

          const { priorityFee } = await this.calculateTransactionFeeAndLimitToMax(baseTransactionData, Infinity);
          const currentNeededPriorityFee = priorityFee > maxPriorityFee ? maxPriorityFee : priorityFee;

          (baseTransactionData.priorityFee as IFees).amount =
            currentNeededPriorityFee > additionalKrc20TransactionPriorityFee
              ? currentNeededPriorityFee
              : additionalKrc20TransactionPriorityFee;

          if (
            !sendAll &&
            context.balance.mature <
              totalPaymentsAmount + MINIMAL_AMOUNT_TO_SEND + (baseTransactionData.priorityFee as IFees).amount &&
            context.balance.pending > 0n
          ) {
            await utxoProcessonManager.waitForPendingUtxoToFinish();
          }

          if (context.balance.mature < totalPaymentsAmount || (outputs.length && outputs[0].amount <= MINIMAL_AMOUNT_TO_SEND)) {
            throw new NotEnoughBalanceError();
          }

          const currentTransactions = await this.utils.retryOnError(async () => {
            return await createTransactions(baseTransactionData);
          });

          console.log('current transaction amount', currentTransactions.transactions.length);
          console.log('current transaction summry', currentTransactions.summary);

          if (additionalOptions.notifyCreatedTransactions) {
            await additionalOptions.notifyCreatedTransactions(currentTransactions.summary.finalTransactionId);
          }

          const transactionsLeftToSend: PendingTransaction[] = [...currentTransactions.transactions];

          while (transactionsLeftToSend.length > 0) {
            const transaction = transactionsLeftToSend[0];
            const isFinalTransaction = transactionsLeftToSend.length == 1;

            if (additionalOptions.specialSignTransactionFunc && isFinalTransaction) {
              await additionalOptions.specialSignTransactionFunc(transaction);
            } else {
              transaction.sign([privateKey]);
            }

            await this.connectAndDo(async () => {
              let transactionReciever = null;

              if (isFinalTransaction) {
                transactionReciever = new TransacionReciever(
                  this.rpcService.getRpc(),
                  this.convertPrivateKeyToPublicKey(privateKey),
                  transaction.id,
                  sendAll,
                );

                await transactionReciever.registerEventHandlers();
              }

              let isTransactionRecieverDisposed = false;

              try {
                await transaction.submit(this.rpcService.getRpc());
                transactionsLeftToSend.shift();

                if (isFinalTransaction) {
                  try {
                    await transactionReciever.waitForTransactionCompletion();
                  } catch (error) {
                    isTransactionRecieverDisposed = true;
                    await transactionReciever.dispose();

                    if (additionalOptions.stopOnApplicationClosing && ImportantPromisesManager.isApplicationClosing()) {
                      throw new ApplicationIsClosingError();
                    }

                    console.log(`Transaction ${transaction.id} not received, trying to get from api...`, new Date());
                    await this.verifyTransactionReceivedOnKaspaApi(transaction.id, additionalOptions.stopOnApplicationClosing);
                  }
                }
              } catch (error) {
                throw error;
              } finally {
                if (isFinalTransaction && !isTransactionRecieverDisposed) {
                  await transactionReciever.dispose();
                }
              }
            });
          }

          return currentTransactions;
        },
      );
    });
  }

  async doKaspaTransferTransactionWithUtxoProcessor(
    privateKey: PrivateKey,
    payments: IPaymentOutput[],
    maxPriorityFee: bigint,
    sendAll = false, // Sends all the remains to the first payment
    notifyCreatedTransactions: (transactionId: string) => Promise<any> = null,
  ) {
    return await this.doTransactionWithUtxoProcessor(privateKey, maxPriorityFee, payments, {
      notifyCreatedTransactions,
      sendAll,
    });
  }

  async doKrc20CommitTransactionWithUtxoProcessor(
    privateKey: PrivateKey,
    krc20transactionData: KRC20OperationDataInterface,
    maxPriorityFee: bigint = 0n,
    baseTransactionAmount = KRC20_BASE_TRANSACTION_AMOUNT,
    notifyCreatedTransactions: (transactionId: string) => Promise<any> = null,
    stopOnApplicationClosing: boolean = false,
  ) {
    const scriptAndScriptAddress = this.createP2SHAddressScript(krc20transactionData, privateKey);

    const outputs = [
      {
        address: scriptAndScriptAddress.p2shaAddress.toString(),
        amount: baseTransactionAmount,
      },
    ];

    return await this.doTransactionWithUtxoProcessor(privateKey, maxPriorityFee, outputs, {
      notifyCreatedTransactions,
      stopOnApplicationClosing,
    });
  }

  async doKrc20RevealTransactionWithUtxoProcessor(
    privateKey: PrivateKey,
    krc20transactionData: KRC20OperationDataInterface,
    transactionFeeAmount: bigint,
    maxPriorityFee: bigint = 0n,
    notifyCreatedTransactions: (transactionId: string) => Promise<any> = null,
    stopOnApplicationClosing: boolean = false,
  ) {
    const scriptAndScriptAddress = this.createP2SHAddressScript(krc20transactionData, privateKey);

    const revealUTXOs = await this.connectAndDo<IGetUtxosByAddressesResponse>(async () => {
      return await this.rpcService.getRpc().getUtxosByAddresses({
        addresses: [scriptAndScriptAddress.p2shaAddress.toString()],
      });
    });

    const priorityEntries = [revealUTXOs.entries[0]];

    const specialSignTransactionFunc = async (transaction: PendingTransaction) => {
      transaction.sign([privateKey], false);
      const ourOutput = transaction.transaction.inputs.findIndex((input) => input.signatureScript === '');

      if (ourOutput !== -1) {
        const signature = await transaction.createInputSignature(ourOutput, privateKey);

        transaction.fillInput(ourOutput, scriptAndScriptAddress.script.encodePayToScriptHashSignatureScript(signature));
      }
    };

    const outputs = [];

    return await this.doTransactionWithUtxoProcessor(privateKey, maxPriorityFee, outputs, {
      notifyCreatedTransactions,
      specialSignTransactionFunc,
      additionalKrc20TransactionPriorityFee: transactionFeeAmount,
      priorityEntries,
      stopOnApplicationClosing,
    });
  }

  // ================================================================
  // OTHER
  // ================================================================

  /**
   *
   * @param privateKey To Send From
   * @param priorityFee Will Aplly twice for both transactions
   * @param transactionData Krc20 Command Data
   * @param transactionFeeAmount transfer - minimal, mint - 1kas, deploy - 1000kas
   * @returns reveal transaction id
   */
  async createKrc20TransactionAndDoReveal(
    privateKey: PrivateKey,
    krc20transactionData: KRC20OperationDataInterface,
    transactionFeeAmount: bigint,
    maxPriorityFee: bigint = 0n,
  ): Promise<Krc20TransactionsResult> {
    const commitTransaction = await this.doKrc20CommitTransaction(privateKey, krc20transactionData, maxPriorityFee);

    const revealTransaction = await this.doKrc20RevealTransaction(
      privateKey,
      krc20transactionData,
      transactionFeeAmount,
      maxPriorityFee,
    );

    return {
      commitTransactionId: commitTransaction.summary.finalTransactionId,
      revealTransactionId: revealTransaction.summary.finalTransactionId,
    };
  }

  convertPrivateKeyToPublicKey(privateKey: PrivateKey): string {
    return privateKey.toPublicKey().toAddress(this.rpcService.getNetwork()).toString();
  }

  async connectAndDo<T>(fn: () => Promise<T>, attempts: number = 5): Promise<T> {
    await this.utils.retryOnError(async () => {
      await this.connectionManager.waitForConnection();
    }, attempts);

    return await fn();
  }

  async getEstimatedPriorityFeeRate(): Promise<number> {
    const estimatedFees = await this.rpcService.getRpc().getFeeEstimate({});

    return estimatedFees.estimate.priorityBucket.feerate;
  }

  async getTransactionFees(transactionData: ICreateTransactions): Promise<FeesCalculation> {
    const estimatedFeeRate = await this.getEstimatedPriorityFeeRate();
    const massAndFeeRate = BigInt(Math.ceil(Number(transactionData.summary.mass) * estimatedFeeRate));
    const maxFee = transactionData.summary.fees > massAndFeeRate ? transactionData.summary.fees : massAndFeeRate;

    const priorityFee = maxFee - transactionData.summary.fees < 0 ? 0n : maxFee - transactionData.summary.fees;

    return {
      originalFee: transactionData.summary.fees,
      mass: transactionData.summary.mass,
      maxFee: maxFee,
      priorityFee: priorityFee,
      estimatedNetworkFee: estimatedFeeRate,
    };
  }

  async getWalletTotalBalance(address: string): Promise<bigint> {
    const result = await this.getWalletTotalBalanceAndUtxos(address);
    return result.totalBalance;
  }

  async getWalletTotalBalanceAndUtxos(address: string): Promise<TotalBalanceWithUtxosInterface> {
    const utxoEntries = await this.getWalletUtxos(address);

    return {
      totalBalance: utxoEntries.reduce((acc, curr) => acc + curr.amount, 0n),
      utxoEntries: utxoEntries,
    };
  }

  async getWalletUtxos(address: string): Promise<UtxoEntryReference[]> {
    const utxos = await this.rpcService.getRpc().getUtxosByAddresses({
      addresses: [address],
    });

    return utxos.entries;
  }

  getPublicKeyAddress(publicKey: string): string {
    return new PublicKey(publicKey).toAddress(this.rpcService.getNetwork()).toString();
  }

  async veryfySignedMessageAndGetWalletAddress(message: string, signature: string, publicKeyStr: string): Promise<string | null> {
    const publicKey = new PublicKey(publicKeyStr);

    if (await verifyMessage({ message, signature, publicKey })) {
      return publicKey.toAddress(this.rpcService.getNetwork()).toString();
    }

    return null;
  }


  async verifyTransactionReceivedOnKaspaApi(txnId: string, stopOnApplicationClosing: boolean = false): Promise<void> {
    await this.utils.retryOnError(
      async () => {
        if (stopOnApplicationClosing) {
          throw new ApplicationIsClosingError();
        }

        return await this.kaspaApiService.getTxnInfo(txnId);
      },
      NUMBER_OF_MINUTES_TO_KEEP_CHECKING_TRANSACTION_RECEIVED,
      TIME_TO_WAIT_BEFORE_TRANSACTION_RECEIVED_CHECK,
      true,
      (error) => error instanceof ApplicationIsClosingError,
    );
  }

  getWalletAddressFromScriptPublicKey(scriptPublicKey: string): string {
    return addressFromScriptPublicKey(scriptPublicKey, this.rpcService.getNetwork()).toString();
  }
}
