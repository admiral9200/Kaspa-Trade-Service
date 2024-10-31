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

export const MINIMAL_AMOUNT_TO_SEND = kaspaToSompi('0.2');

@Injectable()
export class KaspaNetworkTransactionsManagerService {
  constructor(
    private rpcService: RpcService,
    private readonly connectionManager: KaspaNetworkConnectionManagerService,
    private readonly utils: UtilsHelper,
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

  async doKaspaTransferTransactionWithUtxoProcessor(
    privateKey: PrivateKey,
    payments: IPaymentOutput[],
    maxPriorityFee: bigint,
    sendAll = false, // Sends all the remains to the first payment
  ) {
    return await this.connectAndDo<ICreateTransactions>(async () => {
      return await UtxoProcessorManager.useUtxoProcessorManager<ICreateTransactions>(
        this.rpcService.getRpc(),
        this.rpcService.getNetwork(),
        this.convertPrivateKeyToPublicKey(privateKey),
        async (context, utxoProcessonManager) => {
          const totalPaymentAmount = payments.reduce((sum, payment) => sum + payment.amount, 0n);

          const totalPaymentAmountWithoutFirst = totalPaymentAmount - payments[0].amount;
          let currentBalance = context.balance.mature;

          if (sendAll) {
            await utxoProcessonManager.waitForPendingUtxoToFinish();

            currentBalance = context.balance.mature;
            const remeaingAmountToSend = currentBalance - totalPaymentAmountWithoutFirst;

            if (remeaingAmountToSend <= MINIMAL_AMOUNT_TO_SEND) {
              throw new NotEnoughBalanceError();
            }

            payments[0].amount = remeaingAmountToSend;
          } else {
            if (currentBalance < totalPaymentAmount && context.balance.pending > 0n) {
              await utxoProcessonManager.waitForPendingUtxoToFinish();
              currentBalance = context.balance.mature;
            }
          }

          if (currentBalance < totalPaymentAmount) {
            throw new NotEnoughBalanceError();
          }

          const baseTransactionData: IGeneratorSettingsObject = {
            entries: context,
            outputs: payments,
            feeRate: 1.0,
            changeAddress: this.convertPrivateKeyToPublicKey(privateKey),
            priorityFee: {
              amount: 0n,
              source: sendAll ? FeeSource.ReceiverPays : FeeSource.SenderPays,
            },
            networkId: this.rpcService.getNetwork(),
          };

          const transactionsFees = await this.calculateTransactionFeeAndLimitToMax(baseTransactionData, Infinity);
          const priorityFeeToUse = transactionsFees.priorityFee > maxPriorityFee ? maxPriorityFee : transactionsFees.priorityFee;
          (baseTransactionData.priorityFee as IFees).amount = priorityFeeToUse;

          if (payments[0].amount <= MINIMAL_AMOUNT_TO_SEND) {
            throw new NotEnoughBalanceError();
          }

          return await this.utils.retryOnError(async () => {
            return await this.connectAndDo(async () => {
              // console.log('trying to create transaction');
              // console.log('utxo balance mature', context.balance.mature);
              // console.log('utxo balance outgoing', context.balance.outgoing);
              // console.log('utxo balance pending', context.balance.pending);
              // console.log('baseTransactionData', baseTransactionData);
              const transaction = await createTransactions(baseTransactionData);

              console.log('kaspa transfer transaction amount', transaction.transactions.length);
              console.log('kaspa transfer transaction summry', transaction.summary);

              for (let i = 0; i < transaction.transactions.length; i++) {
                const currentTransaction = transaction.transactions[i];
                currentTransaction.sign([privateKey]);

                const transactionReciever = new TransacionReciever(
                  this.rpcService.getRpc(),
                  this.convertPrivateKeyToPublicKey(privateKey),
                  transaction.summary.finalTransactionId,
                  sendAll && i == transaction.transactions.length - 1,
                );

                await transactionReciever.registerEventHandlers();

                try {
                  await currentTransaction.submit(this.rpcService.getRpc());
                  await transactionReciever.waitForTransactionCompletion();
                } catch (error) {
                  throw error;
                } finally {
                  await transactionReciever.dispose();
                }
              }

              return transaction;
            }, 1);
          });
        },
      );
    });
  }

  async doKrc20CommitTransactionWithUtxoProcessor(
    privateKey: PrivateKey,
    krc20transactionData: KRC20OperationDataInterface,
    maxPriorityFee: bigint = 0n,
    baseTransactionAmount = KRC20_BASE_TRANSACTION_AMOUNT,
  ) {
    const scriptAndScriptAddress = this.createP2SHAddressScript(krc20transactionData, privateKey);
    return await this.connectAndDo<ICreateTransactions>(async () => {
      return await UtxoProcessorManager.useUtxoProcessorManager<ICreateTransactions>(
        this.rpcService.getRpc(),
        this.rpcService.getNetwork(),
        this.convertPrivateKeyToPublicKey(privateKey),
        async (context, utxoProcessonManager) => {
          const baseTransactionData: IGeneratorSettingsObject = {
            priorityEntries: [],
            entries: context,
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

          if (context.balance.mature < baseTransactionAmount + MINIMAL_AMOUNT_TO_SEND && context.balance.pending > 0n) {
            await utxoProcessonManager.waitForPendingUtxoToFinish();
          }

          const { priorityFee } = await this.calculateTransactionFeeAndLimitToMax(baseTransactionData, Infinity);
          baseTransactionData.priorityFee = priorityFee > maxPriorityFee ? maxPriorityFee : priorityFee;

          if (
            context.balance.mature < baseTransactionAmount + MINIMAL_AMOUNT_TO_SEND + baseTransactionData.priorityFee &&
            context.balance.pending > 0n
          ) {
            await utxoProcessonManager.waitForPendingUtxoToFinish();
          }

          const commitTransaction = await this.utils.retryOnError(async () => {
            const transaction = await createTransactions(baseTransactionData);

            console.log('commit transaction amount', transaction.transactions.length);
            console.log('commit transaction summry', transaction.summary);

            for (const currentTransaction of transaction.transactions) {
              currentTransaction.sign([privateKey]);

              const transactionReciever = new TransacionReciever(
                this.rpcService.getRpc(),
                this.convertPrivateKeyToPublicKey(privateKey),
                transaction.summary.finalTransactionId,
              );

              await transactionReciever.registerEventHandlers();

              try {
                await currentTransaction.submit(this.rpcService.getRpc());
                await transactionReciever.waitForTransactionCompletion();
              } catch (error) {
                throw error;
              } finally {
                await transactionReciever.dispose();
              }
            }

            return transaction;
          });

          return commitTransaction;
        },
      );
    });
  }

  async doKrc20RevealTransactionWithUtxoProcessor(
    privateKey: PrivateKey,
    krc20transactionData: KRC20OperationDataInterface,
    transactionFeeAmount: bigint,
    maxPriorityFee: bigint = 0n,
  ) {
    const scriptAndScriptAddress = this.createP2SHAddressScript(krc20transactionData, privateKey);

    return await this.connectAndDo<ICreateTransactions>(async () => {
      const revealUTXOs = await this.rpcService.getRpc().getUtxosByAddresses({
        addresses: [scriptAndScriptAddress.p2shaAddress.toString()],
      });

      return await UtxoProcessorManager.useUtxoProcessorManager<ICreateTransactions>(
        this.rpcService.getRpc(),
        this.rpcService.getNetwork(),
        this.convertPrivateKeyToPublicKey(privateKey),
        async (context, utxoProcessonManager) => {
          const baseTransactionData: IGeneratorSettingsObject = {
            priorityEntries: [revealUTXOs.entries[0]],
            entries: context,
            outputs: [],
            feeRate: 1.0,
            changeAddress: this.convertPrivateKeyToPublicKey(privateKey),
            priorityFee: transactionFeeAmount,
            networkId: this.rpcService.getNetwork(),
          };

          if (context.balance.mature < transactionFeeAmount + MINIMAL_AMOUNT_TO_SEND && context.balance.pending > 0n) {
            await utxoProcessonManager.waitForPendingUtxoToFinish();
          }

          const { priorityFee } = await this.calculateTransactionFeeAndLimitToMax(baseTransactionData, Infinity);
          const currentNeededPriorityFee = priorityFee > maxPriorityFee ? maxPriorityFee : priorityFee;

          baseTransactionData.priorityFee =
            currentNeededPriorityFee > transactionFeeAmount ? currentNeededPriorityFee : transactionFeeAmount;

          if (
            context.balance.mature < transactionFeeAmount + MINIMAL_AMOUNT_TO_SEND + baseTransactionData.priorityFee &&
            context.balance.pending > 0n
          ) {
            await utxoProcessonManager.waitForPendingUtxoToFinish();
          }

          const revealTransactions = await this.utils.retryOnError(async () => {
            const currentTransactions = await createTransactions(baseTransactionData);

            console.log('reveal transaction amount', currentTransactions.transactions.length);

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
          });

          return revealTransactions;
        },
      );
    });
  }

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
}
