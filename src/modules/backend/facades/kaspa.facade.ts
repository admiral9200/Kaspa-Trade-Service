import { Injectable } from '@nestjs/common';
import { KaspaNetworkActionsService } from '../services/kaspa-network/kaspa-network-actions.service';
import { WalletAccount } from '../services/kaspa-network/interfaces/wallet-account.interface';
import { P2pOrderEntity } from '../model/schemas/p2p-order.schema';
import { KasplexApiService } from '../services/kasplex-api/services/kasplex-api.service';
import { SwapTransactionsResult } from '../services/kaspa-network/interfaces/SwapTransactionsResult.interface';

@Injectable()
export class KaspaFacade {
  constructor(
    private readonly kaspaNetworkActionsService: KaspaNetworkActionsService,
    private readonly kasplexApiService: KasplexApiService,
  ) {}

  async getAccountWalletAddressAtIndex(sequenceId: number): Promise<string> {
    const walletAccount: WalletAccount = await this.kaspaNetworkActionsService.getWalletAccountAtIndex(sequenceId);
    return walletAccount.address;
  }

  async checkIfWalletHasKrc20Token(address: string, ticker: string, amount: number): Promise<boolean> {
    const walletTokensAmount = await this.kasplexApiService.fetchWalletBalance(address, ticker);

    return walletTokensAmount >= KaspaNetworkActionsService.KaspaToSompi(String(amount));
  }

  async verifyTransactionResultWithKaspaApiAndWalletTotalAmount(
    transactionId: string,
    from: string,
    to: string,
    amount: number,
  ): Promise<boolean> {
    return await this.kaspaNetworkActionsService.verifyTransactionResultWithKaspaApiAndWalletTotalAmount(
      transactionId,
      from,
      to,
      KaspaNetworkActionsService.KaspaToSompi(String(amount)),
    );
  }

  async doSellSwap(order: P2pOrderEntity): Promise<SwapTransactionsResult> {
    try {
      const walletAccount: WalletAccount = await this.kaspaNetworkActionsService.getWalletAccountAtIndex(order.walletSequenceId);
      const holderWalletPrivateKey = walletAccount.privateKey;

      const quantity = KaspaNetworkActionsService.KaspaToSompi(String(order.quantity));
      const totalPrice = KaspaNetworkActionsService.KaspaToSompi(`${order.totalPrice}`);

      return await this.kaspaNetworkActionsService.doSellSwap(
        holderWalletPrivateKey,
        order.buyerWalletAddress,
        order.sellerWalletAddress,
        order.ticker,
        quantity,
        totalPrice,
      );
    } catch (error) {
      throw error;
    }
  }
}
