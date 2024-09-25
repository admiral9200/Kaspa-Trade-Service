import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class KaspaApiService {
  constructor(private readonly httpService: HttpService) {}

  async getTxnInfo(txnId: string): Promise<any> {
    const maxRetries = 5;
    const retryInterval = 3000; // 3 seconds interval

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await firstValueFrom(
          this.httpService.get<any>(
            `transactions/${txnId}?inputs=true&outputs=true&resolve_previous_outpoints=light`,
          ),
        );
        return response.data;
      } catch (error) {
        console.error(`Error fetching transaction info (attempt ${attempt}):`, error);

        if (attempt < maxRetries) {
          // Wait for retryInterval milliseconds before trying again
          await new Promise((resolve) => setTimeout(resolve, retryInterval));
        } else {
          console.error('Max retries reached. Failing now.');
          return null;
        }
      }
    }
  }

  async verifyPaymentTransaction(
    txnId: string,
    senderAddr: string,
    reciverAddr: string,
    amount: number,
  ): Promise<boolean> {
    const receiverAddr = reciverAddr;
    const txnInfo = await this.getTxnInfo(txnId);
    if (!txnInfo) {
      console.error('Transaction info not found.');
      return false;
    }

    // 1. Verify sender address
    const input = txnInfo.inputs.find(
      (input: any) => input.previous_outpoint_address === senderAddr,
    );
    if (!input) {
      console.error('Sender address not found in the inputs.');
      return false;
    }

    // 2. Verify the output amount and receiver address
    const output = txnInfo.outputs.find(
      (output: any) =>
        output.amount === amount && output.script_public_key_address === receiverAddr,
    );

    if (!output) {
      console.error('Receiver address or amount mismatch in the outputs.');
      return false;
    }

    return true;
  }
}
