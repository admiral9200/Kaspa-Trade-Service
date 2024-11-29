import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { first, firstValueFrom } from 'rxjs';
import { UtilsHelper } from 'src/modules/backend/helpers/utils.helper';
import { IKaspaApiTransactionData } from '../model/kaspa-api-transaction-data.interface';
import { groupBy } from 'loadsh';
import { SendTransactionIncorrectDataError } from '../../kaspa-network/errors/SendTransactionIncorrectDataError';
import { IsVerifiedSendAction } from '../model/is-verified-send-action.interface';
import * as _ from 'lodash';

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

  async getTransactionSender(
    txnId: string,
    receiverAddr: string,
    amount: bigint,
    acceptableAmountRange: bigint = 0n,
  ): Promise<string> {
    const txnInfo = await this.getTxnInfo(txnId);
    if (!txnInfo) {
      console.error('Transaction info not found.');
      return null;
    }

    const minAcceptableAmount = amount - acceptableAmountRange;
    const maxAcceptableAmount = amount + acceptableAmountRange;

    // 2. Verify the output amount and receiver address
    const output = txnInfo.outputs.find(
      (output: any) =>
        output.amount >= minAcceptableAmount &&
        output.amount <= maxAcceptableAmount &&
        output.script_public_key_address === receiverAddr,
    );

    if (!output) {
      console.error('Receiver address or amount mismatch in the outputs.');
      return null;
    }

    const inputWallets = Object.keys(
      groupBy(
        txnInfo.inputs.filter((input) => input.previous_outpoint_address),
        (input) => input.previous_outpoint_address,
      ),
    );

    if (inputWallets.length != 1) {
      console.error('Incorrect inputs amount on getTransactionSender');
      return null;
    }

    return inputWallets[0];
  }

  private async verifyPaymentInputsAndOutputs(
    txnInfo: IKaspaApiTransactionData,
    senderAddr: string,
    receiverAddr: string,
    amount: bigint,
    receiverAddrMightGetMore: boolean = false,
    acceptableAmountRange: bigint = 0n,
  ): Promise<boolean> {
    if (!txnInfo) {
      console.error('Transaction info not found.');
      return false;
    }

    // 1. Verify sender address
    const input = txnInfo.inputs.find((input: any) => input.previous_outpoint_address === senderAddr);
    if (!input) {
      return false;
    }

    const minRangeAmount = amount - acceptableAmountRange;
    const maxRangeAmount = amount + acceptableAmountRange;

    // 2. Verify the output amount and receiver address
    const output = txnInfo.outputs.find(
      (output: any) =>
        output.script_public_key_address === receiverAddr &&
        output.amount >= Number(minRangeAmount) &&
        (output.amount <= Number(maxRangeAmount) || receiverAddrMightGetMore),
    );

    if (!output) {
      console.error('Receiver address or amount mismatch in the outputs.');
      return false;
    }

    return true;
  }

  async verifyPaymentTransaction(
    txnId: string,
    senderAddr: string,
    receiverAddr: string,
    amount: bigint,
    receiverAddrMightGetMore: boolean = false,
    acceptableAmountRange: bigint = 0n,
  ): Promise<boolean> {
    const txnInfo = await this.getTxnInfo(txnId);

    return await this.verifyPaymentInputsAndOutputs(
      txnInfo,
      senderAddr,
      receiverAddr,
      amount,
      receiverAddrMightGetMore,
      acceptableAmountRange,
    );
  }

  async verifySendTransactionAndGetCommission(
    txnId: string,
    sellerWalletAddress: string,
    sellerPsktTransactionId: string,
    amount: bigint,
    commissionWallet: string = null,
  ): Promise<IsVerifiedSendAction> {
    const txnInfo = await this.getTxnInfo(txnId);

    // Verify the send transactios
    const listTransactionInput = txnInfo.inputs.find((input: any) => input.previous_outpoint_hash === sellerPsktTransactionId);

    if (!listTransactionInput) {
      return {
        isVerified: false,
      };
    }

    // Find the seller output
    const sellerOutput = txnInfo.outputs.find((output: any) => output.script_public_key_address === sellerWalletAddress);

    if (!sellerOutput) {
      throw new SendTransactionIncorrectDataError(txnInfo, txnId, sellerWalletAddress, sellerPsktTransactionId, amount);
    }

    // Cancel action, only input of the utxo, without sending money
    const inputsBySender = _.groupBy(txnInfo.inputs, (input: any) => input.previous_outpoint_address);

    if (Object.keys(inputsBySender).length === 1) {
      return {
        isVerified: true,
        isCompleted: false,
      };
    }

    // Buy action, verify amount
    const sellerMoneyOutput = txnInfo.outputs.find((input: any) => input.script_public_key_address === sellerWalletAddress);

    if (!sellerMoneyOutput) {
      throw new SendTransactionIncorrectDataError(txnInfo, txnId, sellerWalletAddress, sellerPsktTransactionId, amount);
    }

    if (BigInt(sellerMoneyOutput.amount) < amount) {
      return { isVerified: false };
    }

    // Get buyer address
    const inputsWithoutUtxoInput = txnInfo.inputs.filter((input: any) => input.index !== listTransactionInput.index);

    const moneySenders = _.groupBy(inputsWithoutUtxoInput, (input: any) => input.previous_outpoint_address);

    if (Object.keys(moneySenders).length != 1) {
      throw new SendTransactionIncorrectDataError(txnInfo, txnId, sellerWalletAddress, sellerPsktTransactionId, amount);
    }

    const buyerWalletAddress = Object.keys(moneySenders)[0];

    // Commission
    const commissionOutput = txnInfo.outputs.find((output: any) => output.script_public_key_address === commissionWallet);

    return {
      isVerified: true,
      isCompleted: true,
      buyerWalletAddress,
      commission: BigInt(commissionOutput?.amount || 0) || 0n,
    };
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


  /**
 * Fetches the total available balance for a wallet address (public address).
 * The wallet address is derived from the private key externally. 
 * This function retries the request in case of transient errors.
 * 
 * @param walletAddress - The public wallet address to query.
 * @returns A promise resolving to the available balance of the wallet.
 */
  async fetchTotalBalanceForPublicWallet(walletAddress: string): Promise<number> {
    try {
      return await this.utils.retryOnError(
        async () => {
          const response = await firstValueFrom(
            this.httpService.get<{ balance: number }>(`addresses/${walletAddress}/balance`, {
              timeout: 4 * 60 * 1000,
            })
          );

          if (!response.data || typeof response.data.balance !== 'number') {
            throw new Error('Invalid response format: Missing or invalid "balance" field');
          }

          return response.data.balance;
        },
        3,
        1000,
        true
      );
    } catch (error) {
      console.error(`Failed to fetch balance for wallet: ${walletAddress}`, error);
      throw new Error(`Unable to fetch balance for wallet: ${walletAddress}. Please try again later.`);
    }
  }

}
