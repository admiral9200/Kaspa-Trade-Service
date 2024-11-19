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
import { UserOrdersResponseDto } from '../model/dtos/p2p-orders/user-orders-response.dto';
import { GetUserOrdersRequestDto } from '../model/dtos/p2p-orders/get-user-orders-request.dto';
import { GetOrdersDto } from '../model/dtos/p2p-orders/get-orders.dto';
import { ListedOrderDto } from '../model/dtos/p2p-orders/listed-order.dto';
import { SellOrderStatusV2 } from '../model/enums/sell-order-status-v2.enum';
import { KasplexApiService } from '../services/kasplex-api/services/kasplex-api.service';
import { AppConfigService } from 'src/modules/core/modules/config/app-config.service';

@Injectable()
export class P2pV2Provider {
  constructor(
    private readonly p2pOrdersV2Service: P2pOrdersV2Service,
    private readonly telegramBotService: TelegramBotService,
    private readonly kaspianoBackendApiService: KaspianoBackendApiService,
    private readonly kaspaApiService: KaspaApiService,
    private readonly kasplexApiService: KasplexApiService,
    private readonly config: AppConfigService,
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

    const isVerifiedResult = await this.kaspaApiService.verifyPaymentTransactionAndGetCommission(
      transactionId,
      buyerWalletAddress,
      order.sellerWalletAddress,
      KaspaNetworkActionsService.KaspaToSompi(String(order.totalPrice)),
      true,
      this.config.commitionWalletAddress,
    );

    if (!isVerifiedResult.isVerified) {
      const unverifiedOrder: P2pOrderV2Entity = await this.p2pOrdersV2Service.reopenSellOrder(orderId);

      return P2pOrderV2ResponseTransformer.transformOrderToListedOrderDto(unverifiedOrder);
    }

    const completedOrder = await this.p2pOrdersV2Service.setOrderToCompleted(
      orderId,
      KaspaNetworkActionsService.SompiToNumber(isVerifiedResult.commission || 0n),
    );

    // don't await because not important
    this.telegramBotService.notifyOrderCompleted(completedOrder, true).catch(() => {});
    this.kaspianoBackendApiService.sendMailAfterSwap(completedOrder._id, true).catch((err) => {
      console.error(err);
    });

    return P2pOrderV2ResponseTransformer.transformOrderToListedOrderDto(completedOrder);
  }

  public async cancel(orderId: string): Promise<ListedOrderV2Dto> {
    const order = await this.p2pOrdersV2Service.getById(orderId);

    if (order.status != SellOrderStatusV2.LISTED_FOR_SALE) {
      throw new Error('Invalid status for order');
    }

    const isOffMarketplace = await this.kasplexApiService.validateMarketplaceOrderOffMarket(
      order.ticker,
      order.psktTransactionId,
      order.sellerWalletAddress,
    );

    if (!isOffMarketplace) {
      throw new Error('Order is not off marketplace');
    }

    const updatedOrder: P2pOrderV2Entity = await this.p2pOrdersV2Service.cancelSellOrder(orderId);

    return P2pOrderV2ResponseTransformer.transformOrderToListedOrderDto(updatedOrder);
  }

  async getUserOrders(userOrdersDto: GetUserOrdersRequestDto, walletAddress: string): Promise<UserOrdersResponseDto> {
    const ordersResponse = await this.p2pOrdersV2Service.getUserOrders(
      userOrdersDto.filters,
      userOrdersDto.sort,
      userOrdersDto.pagination,
      walletAddress,
    );

    return {
      allTickers: ordersResponse.allTickers,
      orders: ordersResponse.orders.map((order) => P2pOrderV2ResponseTransformer.transformToUserOrder(order)),
      totalCount: ordersResponse.totalCount,
    };
  }

  async getSellOrders(ticker: string, getSellOrdersDto: GetOrdersDto): Promise<{ orders: ListedOrderDto[]; totalCount: number }> {
    const ordersData = await this.p2pOrdersV2Service.getSellOrders(ticker, getSellOrdersDto.sort, getSellOrdersDto.pagination);

    return {
      orders: ordersData.orders.map((order) => P2pOrderV2ResponseTransformer.transformOrderToListedOrderWithOldDto(order)),
      totalCount: ordersData.totalCount,
    };
  }
}
