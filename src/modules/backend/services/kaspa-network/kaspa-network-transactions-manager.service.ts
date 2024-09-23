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

  createP2SHAddressScript(
    data: KRC20OperationDataInterface,
    privateKey: PrivateKey,
  ) {
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

    const transactions = await createTransactions({
      entries,
      outputs,
      changeAddress: this.convertPrivateKeyToPublicKey(privateKey),
      priorityFee: priorityFee,
      networkId: this.rpcService.getNetwork(),
    });

    return transactions;
  }

  async createKaspaTransferTransactionAndDo(
    privateKey: PrivateKey,
    payments: IPaymentOutput[],
    fee: bigint = null,
    walletShouldBeEmpty = false,
  ) {
    const transferFundsTransaction = await this.createTransaction(
      privateKey,
      payments,
      fee,
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

  async createKrc20TransactionAndDoReveal(
    privateKey: PrivateKey,
    priorityFee: number,
    transactionData: KRC20OperationDataInterface,
    transactionAmount: number,
  ) {
    const scriptAndScriptAddress = this.createP2SHAddressScript(
      transactionData,
      privateKey,
    );

    const { entries } = await this.rpcService.getRpc().getUtxosByAddresses({
      addresses: [this.convertPrivateKeyToPublicKey(privateKey)],
    });

    let startingTransactions: ICreateTransactions;
    try {
      startingTransactions = await createTransactions({
        priorityEntries: [],
        entries,
        outputs: [
          {
            address: scriptAndScriptAddress.p2shaAddress.toString(),
            amount: kaspaToSompi(String(KRC20_BASE_TRANSACTION_AMOUNT)),
          },
        ],
        changeAddress: this.convertPrivateKeyToPublicKey(privateKey),
        priorityFee: kaspaToSompi(String(priorityFee)),
        networkId: this.rpcService.getNetwork(),
      });
    } catch (e) {
      throw new Error(e);
    }

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
      priorityFee: kaspaToSompi(transactionAmount.toFixed(8)),
      networkId: this.rpcService.getNetwork(),
    });

    for (const transaction of revealTransaction.transactions) {
      transaction.sign([privateKey], false);
      const ourOutput = transaction.transaction.inputs.findIndex(
        (input) => input.signatureScript === '',
      );

      if (ourOutput !== -1) {
        const signature = await transaction.createInputSignature(
          ourOutput,
          privateKey,
        );

        transaction.fillInput(
          ourOutput,
          scriptAndScriptAddress.script.encodePayToScriptHashSignatureScript(
            signature,
          ),
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
    return privateKey
      .toPublicKey()
      .toAddress(this.rpcService.getNetwork())
      .toString();
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

  async calculateFeeForTransaction(
    transactionData: ICreateTransactions,
  ): Promise<bigint> {
    const estimatedFees = await this.rpcService.getRpc().getFeeEstimate({});
    const massAndFeeRate =
      transactionData.summary.mass *
      BigInt(estimatedFees.estimate.priorityBucket.feerate);

    return transactionData.summary.fees > massAndFeeRate
      ? transactionData.summary.fees
      : massAndFeeRate;
  }
}
