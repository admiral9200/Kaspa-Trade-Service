import { Injectable } from '@nestjs/common';
import { RpcService } from './rpc.service';
import {
  ICreateTransactions,
  IPaymentOutput,
  kaspaToSompi,
  createTransactions,
  PrivateKey,
  Opcodes,
  addressFromScriptPublicKey,
  ScriptBuilder,
} from 'libs/kaspa-dev/kaspa';
import {
  KRC20_BASE_TRANSACTION_AMOUNT,
  KRC20OperationDataInterface,
} from './classes/KRC20OperationData';
import { TransacionReciever } from './classes/TransacionReciever';
import { FeesCalculation } from './interfaces/FeesCalculation.interface';
import { PriorityFeeTooHighError } from './errors/PriorityFeeTooHighError';

@Injectable()
export class KaspaNetworkTransactionsManagerService {
  constructor(private rpcService: RpcService) {}

  async signAndSubmitTransactions(
    transactionsData: ICreateTransactions,
    privateKey: PrivateKey,
  ): Promise<string[]> {
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

    const scriptAddress = addressFromScriptPublicKey(
      script.createPayToScriptHashScript(),
      this.rpcService.getNetwork(),
    );

    return {
      script: script,
      p2shaAddress: scriptAddress,
    };
  }

  async createTransaction(
    privateKey: PrivateKey,
    outputs: IPaymentOutput[],
    priorityFee: bigint = 0n,
  ) {
    const { entries } = await this.rpcService.getRpc().getUtxosByAddresses({
      addresses: [this.convertPrivateKeyToPublicKey(privateKey)],
    });

    const transactionData = {
      entries,
      outputs,
      changeAddress: this.convertPrivateKeyToPublicKey(privateKey),
      priorityFee: priorityFee,
      networkId: this.rpcService.getNetwork(),
    };

    const transactions = await createTransactions(transactionData);

    return transactions;
  }

  async createKaspaTransferTransactionAndDo(
    privateKey: PrivateKey,
    payments: IPaymentOutput[],
    priorityFee: bigint = null,
    walletShouldBeEmpty = false,
  ) {
    const transferFundsTransaction = await this.createTransaction(
      privateKey,
      payments,
      priorityFee,
    );

    const transactionReciever = new TransacionReciever(
      this.rpcService.getRpc(),
      this.convertPrivateKeyToPublicKey(privateKey),
      transferFundsTransaction.summary.finalTransactionId,
      walletShouldBeEmpty,
    );

    await transactionReciever.registerEventHandlers();

    await this.signAndSubmitTransactions(transferFundsTransaction, privateKey);

    await transactionReciever.waitForTransactionCompletion();

    return transferFundsTransaction.summary.finalTransactionId;
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
  ) {
    const scriptAndScriptAddress = this.createP2SHAddressScript(krc20transactionData, privateKey);

    const { entries } = await this.rpcService.getRpc().getUtxosByAddresses({
      addresses: [this.convertPrivateKeyToPublicKey(privateKey)],
    });

    let currentPriorityFee = 0n;

    const baseTransactionData = {
      priorityEntries: [],
      entries,
      outputs: [
        {
          address: scriptAndScriptAddress.p2shaAddress.toString(),
          amount: kaspaToSompi(String(KRC20_BASE_TRANSACTION_AMOUNT)),
        },
      ],
      changeAddress: this.convertPrivateKeyToPublicKey(privateKey),
      priorityFee: currentPriorityFee,
      networkId: this.rpcService.getNetwork(),
    };

    if (maxPriorityFee && maxPriorityFee > 0n) {
      const checkTransaction = await createTransactions(baseTransactionData);

      const fees = await this.getTransactionFees(checkTransaction);

      if (fees.priorityFee > 0n) {
        if (fees.priorityFee > maxPriorityFee) {
          throw new PriorityFeeTooHighError();
        }

        currentPriorityFee = fees.priorityFee;
        baseTransactionData.priorityFee = fees.priorityFee;

        console.log('priorityFee', currentPriorityFee, maxPriorityFee, fees);
      }
    }

    const startingTransactions = await createTransactions(baseTransactionData);

    const transactionReciever = new TransacionReciever(
      this.rpcService.getRpc(),
      this.convertPrivateKeyToPublicKey(privateKey),
      startingTransactions.summary.finalTransactionId,
    );

    await transactionReciever.registerEventHandlers();

    await this.signAndSubmitTransactions(startingTransactions, privateKey);

    await transactionReciever.waitForTransactionCompletion();

    const newWalletUtxos = await this.rpcService.getRpc().getUtxosByAddresses({
      addresses: [this.convertPrivateKeyToPublicKey(privateKey)],
    });
    const revealUTXOs = await this.rpcService.getRpc().getUtxosByAddresses({
      addresses: [scriptAndScriptAddress.p2shaAddress.toString()],
    });

    const revealTransaction = await createTransactions({
      priorityEntries: [revealUTXOs.entries[0]],
      entries: newWalletUtxos.entries,
      outputs: [],
      changeAddress: this.convertPrivateKeyToPublicKey(privateKey),
      priorityFee: transactionFeeAmount + currentPriorityFee,
      networkId: this.rpcService.getNetwork(),
    });

    for (const transaction of revealTransaction.transactions) {
      transaction.sign([privateKey], false);
      const ourOutput = transaction.transaction.inputs.findIndex(
        (input) => input.signatureScript === '',
      );

      if (ourOutput !== -1) {
        const signature = await transaction.createInputSignature(ourOutput, privateKey);

        transaction.fillInput(
          ourOutput,
          scriptAndScriptAddress.script.encodePayToScriptHashSignatureScript(signature),
        );
      }

      const revealTransactionReciever = new TransacionReciever(
        this.rpcService.getRpc(),
        this.convertPrivateKeyToPublicKey(privateKey),
        revealTransaction.summary.finalTransactionId,
      );

      await revealTransactionReciever.registerEventHandlers();

      const revealHash = await transaction.submit(this.rpcService.getRpc());

      await revealTransactionReciever.waitForTransactionCompletion();

      return revealHash;
    }
  }

  convertPrivateKeyToPublicKey(privateKey: PrivateKey): string {
    return privateKey.toPublicKey().toAddress(this.rpcService.getNetwork()).toString();
  }

  async connectAndDo<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.rpcService.getRpc().isConnected) {
      await this.rpcService.getRpc().connect();
    }

    if (!(await this.isServerValid())) {
      throw new Error('Server is not synced');
    }

    return await fn();
  }

  async isServerValid(): Promise<boolean> {
    const serverInfo = await this.rpcService.getRpc().getServerInfo();
    return serverInfo.isSynced && serverInfo.hasUtxoIndex;
  }

  async getTransactionFees(transactionData: ICreateTransactions): Promise<FeesCalculation> {
    const estimatedFees = await this.rpcService.getRpc().getFeeEstimate({});
    const massAndFeeRate = BigInt(
      Math.ceil(
        Number(transactionData.summary.mass) * estimatedFees.estimate.priorityBucket.feerate,
      ),
    );
    const maxFee =
      transactionData.summary.fees > massAndFeeRate ? transactionData.summary.fees : massAndFeeRate;

    const priorityFee =
      maxFee - transactionData.summary.fees < 0 ? 0n : maxFee - transactionData.summary.fees;

    return {
      originalFee: transactionData.summary.fees,
      mass: transactionData.summary.mass,
      maxFee: maxFee,
      priorityFee: priorityFee,
    };
  }

  async getWalletTotalBalance(address: string): Promise<bigint> {
    const utxos = await this.rpcService.getRpc().getUtxosByAddresses({
      addresses: [address],
    });

    return utxos.entries.reduce((acc, curr) => acc + curr.amount, 0n);
  }
}
