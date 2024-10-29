import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
// import { IKaspaResponse } from '../model/kaspa-response.interface';
// import { IBalanceArray } from '../model/balance-array.interface';
// import { ITokenListResult } from '../model/token-list-result.interface';
// import { ITokenDetailsWithHolders } from '../model/token-details-with-holders.interface';
// import { ITokenOperation } from '../model/token-operation.interface';
import { ITokenOperation, ITokenOperationResponse, OperationAcceptResult } from '../model/token-operation.interface';
import { UtilsHelper } from 'src/modules/backend/helpers/utils.helper';
import { IKaspaResponse } from '../model/kaspa-response.interface';
import { IBalanceArray } from '../model/balance-array.interface';
import { ITokenDetailsWithHolders } from '../model/token-details-with-holders.interface';

@Injectable()
export class KasplexApiService {
  constructor(
    private httpService: HttpService,
    private readonly utils: UtilsHelper,
  ) {}

  // async fetchReceivingBalance(address: string, tokenSymbol: string): Promise<number> {
  //   try {
  //     const response = await firstValueFrom(
  //       this.httpService.get<any>(`krc20/address/${address}/token/${tokenSymbol}`),
  //     );
  //     return response.data.balance / 1e8;
  //   } catch (error) {
  //     console.error('Error fetching receiving balance:', error);
  //     return 0;
  //   }
  // }

  // async fetchTransferHistory(ticker: string, urlParams = ''): Promise<ITokenOperation[]> {
  //   try {
  //     const response = await firstValueFrom(
  //       this.httpService.get<any>(`krc20/oplist/transfer?tick=${ticker}${urlParams}`),
  //     );
  //     return response.data.result.slice(0, 10);
  //   } catch (error) {
  //     console.error('Error fetching transfer history:', error);
  //     return [];
  //   }
  // }

  // async fetchTotalSupply(ticker: string): Promise<number> {
  //   try {
  //     const response = await firstValueFrom(this.httpService.get<any>(`krc20/token/${ticker}`));
  //     const { data } = response;
  //     if (data.result && data.result.length > 0) {
  //       return parseInt(data.result[0].max);
  //     }
  //     throw new Error('Total supply not found');
  //   } catch (error) {
  //     console.error('Error fetching total supply:', error);
  //     return 1;
  //   }
  // }

  // async fetchMintHistory(ticker: string, urlParams = ''): Promise<ITokenOperation[]> {
  //   try {
  //     const response = await firstValueFrom(
  //       this.httpService.get<any>(`krc20/oplist/mint?tick=${ticker}${urlParams}`),
  //     );
  //     return response.data.result.slice(0, 10);
  //   } catch (error) {
  //     console.error('Error fetching mint history:', error);
  //     return [];
  //   }
  // }

  // async fetchTokens(next?: string): Promise<IKaspaResponse<ITokenListResult[]>> {
  //   try {
  //     const nextString = next ? `?next=${next}` : '';
  //     const response = await firstValueFrom(
  //       this.httpService.get<any>(`krc20/tokenlist${nextString}`),
  //     );
  //     return response.data;
  //   } catch (error) {
  //     console.error('Error fetching token list:', error);
  //     return { result: [], next: '', prev: '' };
  //   }
  // }

  async getAddressTokenList(address: string): Promise<IKaspaResponse<IBalanceArray[]>> {
    const response = await firstValueFrom(this.httpService.get<any>(`krc20/address/${address}/tokenlist`));
    return response.data;
  }

  async fetchTokenInfo(ticker: string): Promise<ITokenDetailsWithHolders> {
    const response = await firstValueFrom(
      this.httpService.get<IKaspaResponse<ITokenDetailsWithHolders>>(`krc20/token/${ticker}`),
    );

    return response.data?.result[0];
  }

  async getTokenRemainingMints(ticker: string): Promise<number> {
    const response = await this.fetchTokenInfo(ticker);

    const maxTokens = BigInt(response.max);
    const mintedTokens = BigInt(response.minted);
    return Number((maxTokens - mintedTokens) / BigInt(response.lim));
  }

  async getTokenMintsAmount(ticker: string, amount: number): Promise<bigint> {
    const response = await this.fetchTokenInfo(ticker);

    return BigInt(response.lim) * BigInt(amount);
  }

  // async fetchHoldersCount(ticker: string): Promise<number> {
  //   try {
  //     const response = await firstValueFrom(
  //       this.httpService.get<any>(`krc20/token/${ticker}?holder=true`),
  //     );
  //     return response.data.result.length;
  //   } catch (error) {
  //     console.error('Error fetching holders count:', error);
  //     return 0;
  //   }
  // }

  // async fetchTransactionCount(ticker: string): Promise<number> {
  //   try {
  //     const response = await firstValueFrom(
  //       this.httpService.get<any>(`krc20/oplist/transfer?tick=${ticker}`),
  //     );
  //     return response.data.result.length;
  //   } catch (error) {
  //     console.error('Error fetching transaction count:', error);
  //     return 0;
  //   }
  // }

  // async fetchTotalTokensDeployed(): Promise<number> {
  //   try {
  //     const response = await firstValueFrom(this.httpService.get<any>(`info/`));
  //     return response.data.result.tokenTotal;
  //   } catch (error) {
  //     console.error('Error fetching token count:', error);
  //     return 0;
  //   }
  // }

  async fetchWalletBalance(address: string, ticker: string): Promise<bigint> {
    const response = await firstValueFrom(this.httpService.get<any>(`krc20/address/${address}/token/${ticker}`));

    return response?.data?.result[0].balance;
  }

  async fetchOperationResults(revealTransactoinId: string): Promise<ITokenOperation[]> {
    const response = await firstValueFrom(this.httpService.get<ITokenOperationResponse>(`krc20/op/${revealTransactoinId}`));

    return response.data.result;
  }

  async verifyTransactionResult(
    revealTransactoinId: string,
    ticker: string,
    amount: bigint,
    from: string,
    to: string,
    skipCheckBalance: boolean = false,
  ): Promise<boolean> {
    return await this.utils.retryOnError(
      async () => {
        const transactionsData = await this.fetchOperationResults(revealTransactoinId);

        if (!transactionsData) {
          throw new Error('Transaction not found');
        }

        let transactionFound = false;

        for (const transaction of transactionsData) {
          transactionFound = this.verifySingleTransactionResult(transaction, ticker, amount, from, to);

          if (transactionFound) {
            break;
          }
        }

        if (!transactionFound) {
          return false;
        }

        if (!skipCheckBalance) {
          const balance = await this.fetchWalletBalance(to, ticker);

          return balance >= amount;
        }

        return transactionFound;
      },
      3,
      5000,
    );
  }

  private verifySingleTransactionResult(
    transactionData: ITokenOperation,
    ticker: string,
    amount: bigint,
    from: string,
    to: string,
  ): boolean {
    if (transactionData.opAccept == OperationAcceptResult.PENDING) {
      throw new Error('Transaction still pending');
    }

    if (transactionData.opAccept != OperationAcceptResult.SUCCESS) {
      return false;
    }

    return (
      transactionData.from === from &&
      transactionData.to === to &&
      BigInt(transactionData.amt) === amount &&
      transactionData.tick == ticker
    );
  }
}
