import { Injectable } from '@nestjs/common';
import { KaspaNetworkActionsService } from '../services/kaspa-network/kaspa-network-actions.service';
import { WalletAccount } from '../services/kaspa-network/interfaces/wallet-account.interface';
import { SellOrderDm } from '../model/dms/sell-order.dm';
import { P2pOrder } from '../model/schemas/p2p-order.schema';

@Injectable()
export class KaspaFacade {
  constructor(private readonly kaspaNetworkActionsService: KaspaNetworkActionsService) {}

  async getTempWalletAccountAddressAtIndex(sequenceId: number): Promise<string> {
    const walletAccount: WalletAccount = await this.kaspaNetworkActionsService.getWalletAccountAtIndex(sequenceId);
    return walletAccount.address;
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
      this.kaspaToSompi(String(amount)),
    );
  }

  kaspaToSompi(amount: string): bigint {
    return KaspaNetworkActionsService.KaspaToSompi(String(amount));
  }

  async doSellSwap(order: P2pOrder) {
    try {
      const walletAccount: WalletAccount = await this.kaspaNetworkActionsService.getWalletAccountAtIndex(order.walletSequenceId);
      const holderWalletPrivateKey = walletAccount.privateKey;

      const quantity = KaspaNetworkActionsService.KaspaToSompi(String(order.quantity));
      const totalPrice = KaspaNetworkActionsService.KaspaToSompi(`${order.totalPrice}`);

      await this.kaspaNetworkActionsService.doSellSwap(
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
