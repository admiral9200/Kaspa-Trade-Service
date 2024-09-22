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
export class Krc20TransactionsService {
  constructor(private rpcService: RpcService) {}

  async signAndSubmitTransactions(
    transactionsData: ICreateTransactions,
    privateKey: PrivateKey,
  ): Promise<string[]> {
    const results: string[] = [];

    for (const transaction of transactionsData.transactions) {
      console.log('transaction', transaction);
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

  async createKaspaTransferTransaction(
    privateKey: PrivateKey,
    recipientAdress: string,
    amount: bigint,
    priorityFee: number,
  ) {
    return await this.createTransaction(
      privateKey,
      [
        {
          address: recipientAdress,
          amount,
        },
      ],
      priorityFee,
    );
  }

  async createTransaction(
    privateKey: PrivateKey,
    outputs: IPaymentOutput[],
    priorityFee: number,
  ) {
    const { entries } = await this.rpcService.getRpc().getUtxosByAddresses({
      addresses: [this.convertPrivateKeyToPublicKey(privateKey)],
    });

    const transactions = await createTransactions({
      entries,
      outputs,
      changeAddress: this.convertPrivateKeyToPublicKey(privateKey),
      priorityFee: kaspaToSompi(String(priorityFee)),
      networkId: this.rpcService.getNetwork(),
    });

    return transactions;
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

    let startingTransactions;
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

    console.log(
      'summ',
      startingTransactions.summary,
      JSON.stringify(await this.rpcService.getRpc().getFeeEstimate({})),
    );

    const transactionReciever = new TransacionReciever(
      this.rpcService.getRpc(),
    );

    transactionReciever.registerAddress(
      this.convertPrivateKeyToPublicKey(privateKey),
    );

    const sentedTransactions = await this.signAndSubmitTransactions(
      startingTransactions,
      privateKey,
    );

    await transactionReciever.waitForTransactionCompletion(
      sentedTransactions[0],
    );
    transactionReciever.dispose();

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

      const revealHash = await transaction.submit(this.rpcService.getRpc());

      console.log('summ', revealTransaction.summary);

      console.log('revealHash', revealHash);
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
}
