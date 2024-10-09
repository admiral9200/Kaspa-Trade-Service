import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { UtilsHelper } from 'src/modules/backend/helpers/utils.helper';
import { IKaspaApiTransactionData } from '../model/kaspa-api-transaction-data.interface';

@Injectable()
export class KaspaApiService {
  constructor(
    private readonly httpService: HttpService,
    private readonly utils: UtilsHelper,
  ) {}

  async getTxnInfo(txnId: string): Promise<IKaspaApiTransactionData> {
    return await this.utils.retryOnError(
      async () => {
        const response = await firstValueFrom(
          this.httpService.get<any>(`transactions/${txnId}?inputs=true&outputs=true&resolve_previous_outpoints=light`),
        );

        return response.data;
      },
      5,
      5000,
      true,
    );
  }

  async verifyPaymentTransaction(txnId: string, senderAddr: string, receiverAddr: string, amount: number): Promise<boolean> {
    const txnInfo = await this.getTxnInfo(txnId);
    if (!txnInfo) {
      console.error('Transaction info not found.');
      return false;
    }

    // 1. Verify sender address
    const input = txnInfo.inputs.find((input: any) => input.previous_outpoint_address === senderAddr);
    if (!input) {
      return false;
    }

    // 2. Verify the output amount and receiver address
    const output = txnInfo.outputs.find(
      (output: any) => output.amount === amount && output.script_public_key_address === receiverAddr,
    );

    if (!output) {
      console.error('Receiver address or amount mismatch in the outputs.');
      return false;
    }

    return true;
  }

  async getWalletLastTransactions(walletAddress: string = null, limit: number = 10, offset: number = 0): Promise<any> {
    return await this.utils.retryOnError(
      async () => {
        const response = await firstValueFrom(
          this.httpService.get<any>(
            `addresses/${walletAddress}/full-transactions?limit=${limit}&offset=${offset}&resolve_previous_outpoints=no`,
            {
              timeout: 2 * 60 * 1000,
            },
          ),
        );

        return response.data;
      },
      3,
      1000,
      true,
    );
  }
}
