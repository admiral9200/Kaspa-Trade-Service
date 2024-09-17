import { Injectable } from '@nestjs/common';
import { PrivateKey } from 'libs/kaspa-dev/kaspa';
import { Krc20TransactionsService } from './krc20-transactions.service';

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
    gasFee: number,
  ) {
    return await this.krc20TransactionsService.connectAndDo(async () => {
      const transferFundsTransaction =
        await this.krc20TransactionsService.createKaspaTransferTransaction(
          privateKey,
          recipientAdress,
          amount,
          gasFee,
        );

      await this.krc20TransactionsService.signAndSubmitTransactions(
        transferFundsTransaction,
        privateKey,
      );

      return transferFundsTransaction.summary;
    });
  }
}
