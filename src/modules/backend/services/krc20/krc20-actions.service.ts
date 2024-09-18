import { Injectable } from '@nestjs/common';
import { PrivateKey } from 'libs/kaspa-dev/kaspa';
import { Krc20TransactionsService } from './krc20-transactions.service';
import {
  getTransferData,
  KRC20_TRANSACTIONS_AMOUNTS,
} from './classes/KRC20OperationData';

@Injectable()
export class Krc20ActionsService {
  constructor(
    private readonly krc20TransactionsService: Krc20TransactionsService,
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
          amount,
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
}
