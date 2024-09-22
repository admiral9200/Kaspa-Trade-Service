import { Injectable } from '@nestjs/common';
import { kaspaToSompi, Mnemonic, PrivateKey, XPrv } from 'libs/kaspa-dev/kaspa';
import { Krc20TransactionsService } from './krc20-transactions.service';
import {
  getTransferData,
  KRC20_TRANSACTIONS_AMOUNTS,
} from './classes/KRC20OperationData';
import { AppConfigService } from 'src/modules/core/modules/config/app-config.service';
import { RpcService } from './rpc.service';

@Injectable()
export class Krc20ActionsService {
  constructor(
    private readonly krc20TransactionsService: Krc20TransactionsService,
    private readonly config: AppConfigService,
    private readonly rpcService: RpcService,
  ) {}

  // Amount not in sompi
  async transferKaspa(
    privateKey: PrivateKey,
    recipientAdress: string,
    amount: number,
    priorityFee: number,
  ) {
    return await this.krc20TransactionsService.connectAndDo(async () => {
      const transferFundsTransaction =
        await this.krc20TransactionsService.createKaspaTransferTransaction(
          privateKey,
          recipientAdress,
          kaspaToSompi(String(amount)),
          priorityFee,
        );

      await this.krc20TransactionsService.signAndSubmitTransactions(
        transferFundsTransaction,
        privateKey,
      );

      return transferFundsTransaction.summary;
    });
  }

  async transferAllAvailableKaspaInWallet(
    privateKey: PrivateKey,
    recipientAdress: string,
    priorityFee: number,
  ) {
    return await this.krc20TransactionsService.connectAndDo(async () => {
      const totalAmount = await this.getWalletTotalBalance(
        privateKey
          .toPublicKey()
          .toAddress(this.rpcService.getNetwork())
          .toString(),
      );

      console.log(totalAmount);

      const checkTransaction =
        await this.krc20TransactionsService.createKaspaTransferTransaction(
          privateKey,
          recipientAdress,
          totalAmount,
          priorityFee,
        );

      console.log('frr', checkTransaction.summary.fees);

      return;

      const transferFundsTransaction =
        await this.krc20TransactionsService.createKaspaTransferTransaction(
          privateKey,
          recipientAdress,
          0n,
          priorityFee,
        );

      await this.krc20TransactionsService.signAndSubmitTransactions(
        transferFundsTransaction,
        privateKey,
      );

      return transferFundsTransaction.summary;
    });
  }

  // Amount not in sompi
  async transferKrc20Token(
    privateKey: PrivateKey,
    ticker: string,
    recipientAdress: string,
    amount: number,
    priorityFee: number,
  ) {
    return await this.krc20TransactionsService.connectAndDo(async () => {
      const result =
        await this.krc20TransactionsService.createKrc20TransactionAndDoReveal(
          privateKey,
          priorityFee,
          getTransferData(ticker, amount, recipientAdress),
          KRC20_TRANSACTIONS_AMOUNTS.TRANSFER,
        );

      return result;
    });
  }

  async createWallet() {
    const mnemonic = Mnemonic.random();
    const seed = mnemonic.toSeed(this.config.walletSeed);
    const xprv = new XPrv(seed);

    const receivePrivateKey = xprv
      .derivePath("m/44'/111111'/0'/0/0")
      .toPrivateKey(); // Derive the private key for the receive address
    const changePrivateKey = xprv
      .derivePath("m/44'/111111'/0'/1/0")
      .toPrivateKey(); // Derive the private key for the change address

    const receivePublicKey = receivePrivateKey.toPublicKey();
    const changePublicKey = changePrivateKey.toPublicKey();

    const receiveAddress = receivePublicKey
      .toAddress(this.rpcService.getNetwork())
      .toString();
    const changeAddress = changePublicKey
      .toAddress(this.rpcService.getNetwork())
      .toString();

    const receivePrivateKeyString = receivePrivateKey.toString();
    const changePrivateKeyString = changePrivateKey.toString();

    return {
      mnemonic: mnemonic.phrase,
      receivePrivateKey: receivePrivateKeyString,
      changePrivateKey: changePrivateKeyString,
      receive: receiveAddress,
      change: changeAddress,
    };
  }

  async getWalletTotalBalance(address: string): Promise<bigint> {
    return await this.krc20TransactionsService.connectAndDo(async () => {
      const utxos = await this.rpcService.getRpc().getUtxosByAddresses({
        addresses: [address],
      });

      return utxos.entries.reduce((acc, curr) => acc + curr.amount, 0n);
    });
  }
}
