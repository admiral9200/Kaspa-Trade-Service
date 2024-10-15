import { Injectable } from '@nestjs/common';
import { AMOUNT_FOR_SWAP_FEES, KaspaNetworkActionsService } from '../services/kaspa-network/kaspa-network-actions.service';
import { WalletAccount } from '../services/kaspa-network/interfaces/wallet-account.interface';
import { P2pOrderEntity } from '../model/schemas/p2p-order.schema';
import { KasplexApiService } from '../services/kasplex-api/services/kasplex-api.service';
import { SwapTransactionsResult } from '../services/kaspa-network/interfaces/SwapTransactionsResult.interface';
import { LunchpadOrder } from '../model/schemas/lunchpad-order.schema';
import { KRC20ActionTransations } from '../services/kaspa-network/interfaces/Krc20ActionTransactions.interface';
import { LunchpadEntity } from '../model/schemas/lunchpad.schema';
import { LunchpadWalletTokenBalanceIncorrect } from '../services/kaspa-network/errors/LunchpadWalletTokenBalanceIncorrect';

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
    const walletTokensAmount = await this.getKrc20TokenBalance(address, ticker);

    return walletTokensAmount >= KaspaNetworkActionsService.KaspaToSompi(String(amount));
  }

  async getKrc20TokenBalance(address: string, ticker: string): Promise<bigint> {
    return await this.kasplexApiService.fetchWalletBalance(address, ticker);
  }

  async verifyTransactionResultWithKaspaApiAndWalletTotalAmountWithSwapFee(
    transactionId: string,
    from: string,
    to: string,
    amount: number = 0,
  ): Promise<boolean> {
    return await this.kaspaNetworkActionsService.verifyTransactionResultWithKaspaApiAndWalletTotalAmount(
      transactionId,
      from,
      to,
      KaspaNetworkActionsService.KaspaToSompi(String(amount)) + AMOUNT_FOR_SWAP_FEES,
    );
  }

  async doSellSwap(
    order: P2pOrderEntity,
    notifyUpdate: (result: Partial<SwapTransactionsResult>) => Promise<void>,
  ): Promise<SwapTransactionsResult> {
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
        order.transactions || {},
        notifyUpdate,
      );
    } catch (error) {
      throw error;
    }
  }

  async delistSellSwap(
    order: P2pOrderEntity,
    notifyUpdate: (result: Partial<SwapTransactionsResult>) => Promise<void>,
  ): Promise<Partial<SwapTransactionsResult>> {
    const walletAccount: WalletAccount = await this.kaspaNetworkActionsService.getWalletAccountAtIndex(order.walletSequenceId);
    const holderWalletPrivateKey = walletAccount.privateKey;

    const quantity = KaspaNetworkActionsService.KaspaToSompi(String(order.quantity));

    return await this.kaspaNetworkActionsService.cancelSellSwap(
      holderWalletPrivateKey,
      order.sellerWalletAddress,
      order.ticker,
      quantity,
      order.transactions || {},
      notifyUpdate,
    );
  }

  async verifyTokensAndProcessLunchpadOrder(
    lunchpadOrder: LunchpadOrder,
    lunchpad: LunchpadEntity,
    notifyUpdate: (result: Partial<KRC20ActionTransations>) => Promise<void>,
  ): Promise<KRC20ActionTransations> {
    // Verify wallet amount
    const lunchpadWallet = await this.kaspaNetworkActionsService.getWalletAccountAtIndex(lunchpad.walletSequenceId);

    const lunchpadWalletTokensAmount = KaspaNetworkActionsService.SompiToNumber(
      await this.getKrc20TokenBalance(lunchpadWallet.address, lunchpad.ticker),
    );

    if (lunchpadWalletTokensAmount != lunchpad.currentTokensAmount) {
      throw new LunchpadWalletTokenBalanceIncorrect(
        lunchpad.ticker,
        lunchpadWallet.address,
        lunchpad.currentTokensAmount,
        lunchpadWalletTokensAmount,
      );
    }

    return await this.kaspaNetworkActionsService.transferKrc20TokenAndNotify(
      lunchpadWallet.privateKey,
      lunchpadOrder.userWalletAddress,
      lunchpad.ticker,
      KaspaNetworkActionsService.KaspaToSompi(String(lunchpadOrder.totalUnits * lunchpadOrder.tokenPerUnit)),
      lunchpadOrder.transactions || {},
      KaspaNetworkActionsService.KaspaToSompi(String(lunchpad.maxFeeRatePerTransaction)),
      notifyUpdate,
    );
  }
}
