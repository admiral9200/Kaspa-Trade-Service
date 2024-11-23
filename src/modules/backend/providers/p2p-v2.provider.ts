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
import { KasplexApiService } from '../services/kasplex-api/services/kasplex-api.service';
import { AppConfigService } from 'src/modules/core/modules/config/app-config.service';
import { IsVerifiedSendAction } from '../services/kaspa-api/model/is-verified-send-action.interface';
import { FailedOrderVerification } from '../services/kaspa-network/errors/FailedSellOrderVerification';
import { AppLogger } from 'src/modules/core/modules/logger/app-logger.abstract';

@Injectable()
export class P2pV2Provider {
  constructor(
    private readonly p2pOrdersV2Service: P2pOrdersV2Service,
    private readonly telegramBotService: TelegramBotService,
    private readonly kaspianoBackendApiService: KaspianoBackendApiService,
    private readonly kaspaApiService: KaspaApiService,
    private readonly kasplexApiService: KasplexApiService,
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
  ) {}

  public async createOrder(sellOrderDto: SellOrderV2Dto, walletAddress: string): Promise<SellRequestV2ResponseDto> {
    const createdOrderEntity: P2pOrderV2Entity = await this.p2pOrdersV2Service.create(sellOrderDto, walletAddress);

    return P2pOrderV2ResponseTransformer.createSellOrderCreatedResponseDto(createdOrderEntity);
  }

  public async getOrderById(orderId: string): Promise<ListedOrderV2Dto> {
    const orderEntity: P2pOrderV2Entity = await this.p2pOrdersV2Service.getById(orderId);

    return P2pOrderV2ResponseTransformer.transformOrderToListedOrderDto(orderEntity);
  }

  private async verifySendTransactionAndSendErrorIfNeeded(
    transactionId: string,
    order: P2pOrderV2Entity,
  ): Promise<IsVerifiedSendAction> {
    try {
      return await this.kaspaApiService.verifySendTransactionAndGetCommission(
        transactionId,
        order.sellerWalletAddress,
        order.psktTransactionId,
        KaspaNetworkActionsService.KaspaToSompiFromNumber(order.totalPrice),
        this.config.commitionWalletAddress,
      );
    } catch (error) {
      this.telegramBotService.sendErrorToErrorsChannel(error);
      this.logger.error(error?.message || error, error?.stack, error?.meta);
    }

    return { isVerified: false };
  }

  public async verify(sellOrderId: string, transactionId?: string): Promise<ListedOrderV2Dto> {
    try {
      let order: P2pOrderV2Entity = null;

      try {
        order = await this.p2pOrdersV2Service.updateStatusToVerifying(sellOrderId);
      } catch (error) {
        if (this.p2pOrdersV2Service.isOrderInvalidStatusUpdateError(error)) {
          return P2pOrderV2ResponseTransformer.transformOrderToListedOrderDto(await this.p2pOrdersV2Service.getById(sellOrderId));
        }

        throw error;
      }

      const isOffMarketplace = await this.kasplexApiService.validateMarketplaceOrderOffMarket(
        order.ticker,
        order.psktTransactionId,
        order.sellerWalletAddress,
      );

      if (!isOffMarketplace) {
        order = await this.p2pOrdersV2Service.reopenSellOrder(order._id);
        return P2pOrderV2ResponseTransformer.transformOrderToListedOrderDto(order);
      }

      let sendTransaction = transactionId;

      let isVerifiedResult: IsVerifiedSendAction = { isVerified: false };

      if (sendTransaction) {
        isVerifiedResult = await this.verifySendTransactionAndSendErrorIfNeeded(sendTransaction, order);
      } else {
        this.logger.warn('Transaction id is not provided for sell order ' + order._id + '.');
        this.telegramBotService.sendErrorToErrorsChannel(
          'Warning: Transaction id is not provided for sell order ' + order._id + '.',
        );

        // Find transaction
        const possibleTransactions = await this.kasplexApiService.findSendOrderPossibleTransactions(
          order.sellerWalletAddress,
          order.ticker,
          KaspaNetworkActionsService.KaspaToSompiFromNumber(order.quantity),
          KaspaNetworkActionsService.KaspaToSompiFromNumber(order.totalPrice),
        );

        for (let i = 0; i < possibleTransactions.length; i++) {
          sendTransaction = possibleTransactions[i];
          isVerifiedResult = await this.verifySendTransactionAndSendErrorIfNeeded(sendTransaction, order);

          if (isVerifiedResult.isVerified) {
            break;
          }
        }
      }

      if (isVerifiedResult.isVerified) {
        if (isVerifiedResult.isCompleted) {
          order = await this.completeOrder(order, sendTransaction, isVerifiedResult);
        } else {
          order = await this.cancelOrder(order, sendTransaction);
        }
      } else {
        order = await this.p2pOrdersV2Service.setOrderToFailedVerification(order._id);
        const failedVerificationError = new FailedOrderVerification(order);
        this.logger.error(failedVerificationError.message, failedVerificationError.stack);
        this.telegramBotService.sendErrorToErrorsChannel(failedVerificationError);
      }

      return P2pOrderV2ResponseTransformer.transformOrderToListedOrderDto(order);
    } catch (error) {
      this.telegramBotService.sendErrorToErrorsChannel(error);
      this.logger.error(error?.message || error, error?.stack, error?.meta);
      throw error;
    }
  }

  public async completeOrder(
    order: P2pOrderV2Entity,
    transactionId: string,
    verificationResult: IsVerifiedSendAction,
  ): Promise<P2pOrderV2Entity> {
    const completedOrder = await this.p2pOrdersV2Service.setOrderToCompleted(
      order._id,
      verificationResult.buyerWalletAddress,
      transactionId,
      KaspaNetworkActionsService.SompiToNumber(verificationResult.commission || 0n),
    );

    // don't await because not important
    this.telegramBotService.notifyOrderCompleted(completedOrder, true).catch(() => {});
    this.kaspianoBackendApiService.sendMailAfterSwap(completedOrder._id, true).catch((err) => {
      console.error(err);
    });

    return completedOrder;
  }

  public async cancelOrder(order: P2pOrderV2Entity, transactionId: string): Promise<P2pOrderV2Entity> {
    return await this.p2pOrdersV2Service.setOrderToCanceled(order._id, transactionId);
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
    const ordersData = await this.p2pOrdersV2Service.getSellOrders(
      ticker,
      getSellOrdersDto.sort,
      getSellOrdersDto.pagination,
      getSellOrdersDto.completedOrders,
    );

    return {
      orders: ordersData.orders.map((order) => P2pOrderV2ResponseTransformer.transformOrderToListedOrderWithOldDto(order)),
      totalCount: ordersData.totalCount,
    };
  }

  async getUserUnlistedTransactions(transactions: string[], walletAddress: string): Promise<string[]> {
    return await this.p2pOrdersV2Service.getUserUnlistedTransactions(transactions, walletAddress);
  }
}
