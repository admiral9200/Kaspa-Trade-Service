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
} from 'libs/kaspa/kaspa';
import { KRC20_BASE_TRANSACTION_AMOUNT, KRC20OperationDataInterface } from './classes/KRC20OperationData';
import { TransacionReciever } from './classes/TransacionReciever';
import { FeesCalculation } from './interfaces/FeesCalculation.interface';
import { PriorityFeeTooHighError } from './errors/PriorityFeeTooHighError';
import { Krc20TransactionsResult } from './interfaces/Krc20TransactionsResult.interface copy';
import { UtilsHelper } from '../../helpers/utils.helper';
import { TotalBalanceWithUtxosInterface } from './interfaces/TotalBalanceWithUtxos.interface';
import { NotEnoughBalanceError } from './errors/NotEnoughBalance';

export const MINIMAL_AMOUNT_TO_SEND = kaspaToSompi('0.2');

@Injectable()
export class KaspaNetworkTransactionsManagerService {
  constructor(
    private rpcService: RpcService,
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

      payments[0].amount = walletUtxoInfo.totalBalance - MINIMAL_AMOUNT_TO_SEND;
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

    if (sendAll) {
      payments[0].amount = walletUtxoInfo.totalBalance - transactionsFees.maxFee;
    }

    return await this.utils.retryOnError(async () => {
      const transferFundsTransaction = await createTransactions(transactionData);

      const transactionReciever = new TransacionReciever(
        this.rpcService.getRpc(),
        this.convertPrivateKeyToPublicKey(privateKey),
        transferFundsTransaction.summary.finalTransactionId,
        sendAll,
      );

      await transactionReciever.registerEventHandlers();

      console.log('trans sum', transferFundsTransaction.summary);

      try {
        await this.signAndSubmitTransactions(transferFundsTransaction, privateKey);

        await transactionReciever.waitForTransactionCompletion();
      } catch (error) {
        throw error;
      } finally {
        await transactionReciever.dispose();
      }

      return transferFundsTransaction;
    });
  }

  async calculateTransactionFeeAndLimitToMax(transactionData, maxPriorityFee): Promise<FeesCalculation> {
    const finalFees = await this.utils.retryOnError(async () => {
      const currentTransaction = await createTransactions(transactionData);

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
          amount: KRC20_BASE_TRANSACTION_AMOUNT,
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
    });

    return revealTransactions;
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

  async connectAndDo<T>(fn: () => Promise<T>): Promise<T> {
    await this.utils.retryOnError(async () => {
      if (!this.rpcService.getRpc().isConnected) {
        await this.rpcService.getRpc().connect();
      }

      if (!(await this.isServerValid())) {
        this.rpcService.getRpc().disconnect();
        throw new Error('Server is not synced');
      }
    });

    return await fn();
  }

  async isServerValid(): Promise<boolean> {
    const serverInfo = await this.rpcService.getRpc().getServerInfo();
    return serverInfo.isSynced && serverInfo.hasUtxoIndex;
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
}
