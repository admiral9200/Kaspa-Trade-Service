import { Injectable } from '@nestjs/common';
import { RpcService } from './rpc.service';
import {
  ICreateTransactions,
  IPaymentOutput,
  kaspaToSompi,
  createTransactions, PrivateKey
} from 'libs/kaspa-dev/kaspa';
import { UtxoProcessorHandler } from './classes/utxo-processor-handler';

@Injectable()
export class Krc20TransactionsService {
  constructor(private rpcService: RpcService) {}

  async signAndSubmitTransactions(
    transactionsData: ICreateTransactions,
    privateKey: PrivateKey,
  ) {
    for (const transaction of transactionsData.transactions) {
      transaction.sign([privateKey]);
      await transaction.submit(this.rpcService.getRpc());
    }
  }

  async createKaspaTransferTransaction(
    privateKey: PrivateKey,
    recipientAdress: string,
    amount: number,
    gasFee: number,
  ) {
    return await this.createTransaction(
      privateKey,
      [
        {
          address: recipientAdress,
          amount: kaspaToSompi(String(amount)),
        },
      ],
      gasFee,
      true,
    );
  }

  async createTransaction(
    privateKey: PrivateKey,
    outputs: IPaymentOutput[],
    gasFee: number,
    processor = false,
  ) {
    let entries;
    let handler: UtxoProcessorHandler = null;

    if (processor) {
      handler = new UtxoProcessorHandler(
        {
          rpc: this.rpcService.getRpc(),
          networkId: this.rpcService.getNetwork(),
        },
        privateKey,
      );

      await handler.registerProcessorAndWaitForResponse();

      entries = handler.getContext();
    } else {
      throw new Error('Not implemented');

      // const utxos = await this.rpcService.getRpc().getUtxosByAddresses({
      //   addresses: [this.convertPrivateKeyToPublicKey(privateKey)],
      // });

      // entries = utxos.entries;
    }

    const transactions = await createTransactions({
      entries,
      outputs,
      changeAddress: this.convertPrivateKeyToPublicKey(privateKey),
      priorityFee: kaspaToSompi(String(gasFee)),
    });

    if (handler) {
      handler.dispose();
    }

    return transactions;
  }

  convertPrivateKeyToPublicKey(privateKey: PrivateKey): string {
    return privateKey
      .toPublicKey()
      .toAddress(this.rpcService.getNetwork())
      .toString();
  }

  async connectAndDo<T>(fn: () => Promise<T>): Promise<T> {
    try {
      await this.rpcService.getRpc().connect();

      if (!(await this.isServerValid())) {
        throw new Error('Server is not synced');
      }

      return await fn();
    } catch (err) {
      throw err;
    } finally {
      this.rpcService.getRpc().disconnect();
    }
  }

  async isServerValid(): Promise<boolean> {
    const serverInfo = await this.rpcService.getRpc().getServerInfo();
    return serverInfo.isSynced && serverInfo.hasUtxoIndex;
  }
}
