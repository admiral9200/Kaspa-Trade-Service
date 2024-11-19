import { Injectable } from '@nestjs/common';
import { SellOrderV2Dto } from '../model/dtos/p2p-orders/sell-order-v2.dto';
import { SellRequestV2ResponseDto } from '../model/dtos/p2p-orders/responses/sell-request-v2.response.dto';
import { P2pOrderV2Entity } from '../model/schemas/p2p-order-v2.schema';
import { P2pOrdersV2Service } from '../services/p2p-orders-v2.service';
import { P2pOrderV2ResponseTransformer } from '../transformers/p2p-order-v2-response.transformer';
import { ListedOrderV2Dto } from '../model/dtos/p2p-orders/listed-order-v2.dto';
import { TelegramBotService } from 'src/modules/shared/telegram-notifier/services/telegram-bot.service';
import { KaspianoBackendApiService } from '../services/kaspiano-backend-api/services/kaspiano-backend-api.service';
import { KaspaApiService } from '../services/kaspa-api/services/kaspa-api.service';
import { KaspaNetworkActionsService } from '../services/kaspa-network/kaspa-network-actions.service';

@Injectable()
export class P2pV2Provider {
  constructor(
    private readonly p2pOrdersV2Service: P2pOrdersV2Service,
    private readonly telegramBotService: TelegramBotService,
    private readonly kaspianoBackendApiService: KaspianoBackendApiService,
    private readonly kaspaApiService: KaspaApiService,
  ) {}

  public async createOrder(sellOrderDto: SellOrderV2Dto, walletAddress: string): Promise<SellRequestV2ResponseDto> {
    const createdOrderEntity: P2pOrderV2Entity = await this.p2pOrdersV2Service.create(sellOrderDto, walletAddress);

    return P2pOrderV2ResponseTransformer.createSellOrderCreatedResponseDto(createdOrderEntity);
  }

  public async getOrderById(orderId: string): Promise<ListedOrderV2Dto> {
    const orderEntity: P2pOrderV2Entity = await this.p2pOrdersV2Service.getById(orderId);

    return P2pOrderV2ResponseTransformer.transformOrderToListedOrderDto(orderEntity);
  }

  public async buy(orderId: string, buyerWalletAddress: string, transactionId: string): Promise<ListedOrderV2Dto> {
    if (!transactionId) {
      throw new Error('transactionId is required');
    }

    const order: P2pOrderV2Entity = await this.p2pOrdersV2Service.updateBuyerAndStatus(
      orderId,
      buyerWalletAddress,
      transactionId,
    );

    const isVerified = await this.kaspaApiService.verifyPaymentTransaction(
      transactionId,
      buyerWalletAddress,
      order.sellerWalletAddress,
      KaspaNetworkActionsService.KaspaToSompi(String(order.totalPrice)),
      true,
    );

    console.log('isVerified', isVerified);

    if (!isVerified) {
      const unverifiedOrder: P2pOrderV2Entity = await this.p2pOrdersV2Service.reopenSellOrder(orderId);

      return P2pOrderV2ResponseTransformer.transformOrderToListedOrderDto(unverifiedOrder);
    }

    const completedOrder = await this.p2pOrdersV2Service.setOrderToCompleted(orderId);

    // don't await because not important
    this.telegramBotService.notifyOrderCompleted(completedOrder).catch(() => {});
    this.kaspianoBackendApiService.sendMailAfterSwap(completedOrder._id, true).catch((err) => {
      console.error(err);
    });

    return P2pOrderV2ResponseTransformer.transformOrderToListedOrderDto(completedOrder);
  }

  public async cancel(orderId: string, ownerWalletAddess: string): Promise<ListedOrderV2Dto> {
    // need to add validation to see if the buyer really bought
    const order: P2pOrderV2Entity = await this.p2pOrdersV2Service.cancelSellOrder(orderId, ownerWalletAddess);

    return P2pOrderV2ResponseTransformer.transformOrderToListedOrderDto(order);
  }
}
