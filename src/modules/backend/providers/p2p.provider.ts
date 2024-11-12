import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { SellOrderDto } from '../model/dtos/p2p-orders/sell-order.dto';
import { P2pOrdersService } from '../services/p2p-orders.service';
import { P2pOrderBookTransformer } from '../transformers/p2p-order-book.transformer';
import { OrderDm } from '../model/dms/order.dm';
import { P2pOrderBookResponseTransformer } from '../transformers/p2p-order-book-response.transformer';
import { ConfirmSellOrderRequestResponseDto } from '../model/dtos/p2p-orders/responses/confirm-sell-order-request.response.dto';
import { BuyRequestResponseDto } from '../model/dtos/p2p-orders/responses/buy-request.response.dto';
import { SellRequestResponseDto } from '../model/dtos/p2p-orders/responses/sell-request.response.dto';
import { ConfirmBuyOrderRequestResponseDto } from '../model/dtos/p2p-orders/responses/confirm-buy-order-request.response.dto';
import { KaspaNetworkActionsService } from '../services/kaspa-network/kaspa-network-actions.service';
import { KaspaFacade } from '../facades/kaspa.facade';
import { TemporaryWalletSequenceService } from '../services/temporary-wallet-sequence.service';
import { P2pOrderEntity } from '../model/schemas/p2p-order.schema';
import { ConfirmBuyRequestDto } from '../model/dtos/p2p-orders/confirm-buy-request.dto';
import { GetOrdersDto } from '../model/dtos/p2p-orders/get-orders.dto';
import { ListedOrderDto } from '../model/dtos/p2p-orders/listed-order.dto';
import { SwapTransactionsResult } from '../services/kaspa-network/interfaces/SwapTransactionsResult.interface';
import { PriorityFeeTooHighError } from '../services/kaspa-network/errors/PriorityFeeTooHighError';
import { ConfirmDelistRequestDto } from '../model/dtos/p2p-orders/confirm-delist-request.dto';
import { ConfirmDelistOrderRequestResponseDto } from '../model/dtos/p2p-orders/responses/confirm-delist-order-request.response.dto copy';
import { InvalidStatusForOrderUpdateError } from '../services/kaspa-network/errors/InvalidStatusForOrderUpdate';
import { OffMarketplaceRequestResponseDto } from '../model/dtos/p2p-orders/responses/off-marketplace-request.response.dto';
import { UpdateSellOrderDto } from '../model/dtos/p2p-orders/update-sell-order.dto';
import { SellOrderStatus } from '../model/enums/sell-order-status.enum';
import { P2pOrderHelper } from '../helpers/p2p-order.helper';
import { TotalBalanceWithUtxosInterface } from '../services/kaspa-network/interfaces/TotalBalanceWithUtxos.interface';
import { GetOrdersHistoryDto } from '../model/dtos/p2p-orders/get-orders-history.dto';
import { GetOrdersHistoryResponseDto } from '../model/dtos/p2p-orders/get-orders-history-response.dto';
import { GetOrderStatusResponseDto } from '../model/dtos/p2p-orders/get-order-status-response.dto';
import { isEmptyString } from '../utils/object.utils';
import { TelegramBotService } from 'src/modules/shared/telegram-notifier/services/telegram-bot.service';
import { UnknownMoneyError } from '../services/kaspa-network/errors/UnknownMoneyError';
import { AppLogger } from 'src/modules/core/modules/logger/app-logger.abstract';
import { StuckOrdersError } from '../services/kaspa-network/errors/StuckOrdersError';
import { KaspianoBackendApiService } from '../services/kaspiano-backend-api/services/kaspiano-backend-api.service';

@Injectable()
export class P2pProvider {
  constructor(
    private readonly kaspaFacade: KaspaFacade,
    private readonly p2pOrderBookService: P2pOrdersService,
    private readonly temporaryWalletService: TemporaryWalletSequenceService,
    private readonly kaspaNetworkActionsService: KaspaNetworkActionsService,
    private readonly telegramBotService: TelegramBotService,
    private readonly kaspianoBackendApiService: KaspianoBackendApiService,
    private readonly logger: AppLogger,
  ) {}

  public async listOrders(
    ticker: string,
    getSellOrdersRequestDto: GetOrdersDto,
  ): Promise<{ orders: ListedOrderDto[]; totalCount: number }> {
    const { orders, totalCount } = await this.p2pOrderBookService.getSellOrders(ticker, getSellOrdersRequestDto);
    return {
      orders: orders.map((order) => P2pOrderBookTransformer.transformP2pOrderEntityToListedOrderDto(order)),
      totalCount,
    };
  }

  public async userListings(
    getSellOrdersRequestDto: GetOrdersDto,
    walletAddress: string,
  ): Promise<{ orders: ListedOrderDto[]; totalCount: number }> {
    const { orders, totalCount } = await this.p2pOrderBookService.getUserListings(getSellOrdersRequestDto, walletAddress);
    return {
      orders: orders.map((order) => P2pOrderBookTransformer.transformP2pOrderEntityToListedOrderDto(order)),
      totalCount,
    };
  }

  public async createOrder(sellOrderDto: SellOrderDto, walletAddress: string): Promise<SellRequestResponseDto> {
    const walletSequenceId: number = await this.temporaryWalletService.getNextSequenceId();

    const createdOrderEntity: P2pOrderEntity = await this.p2pOrderBookService.createSell(
      sellOrderDto,
      walletSequenceId,
      walletAddress,
    );
    const temporaryWalletPublicAddress: string = await this.kaspaFacade.getAccountWalletAddressAtIndex(walletSequenceId);

    return P2pOrderBookResponseTransformer.createSellOrderCreatedResponseDto(createdOrderEntity, temporaryWalletPublicAddress);
  }

  async getCurrentFeeRate() {
    return await this.kaspaNetworkActionsService.getCurrentFeeRate();
  }

  public async buy(orderId: string, buyerWalletAddress: string): Promise<BuyRequestResponseDto> {
    try {
      const order = await this.p2pOrderBookService.getOrderById(orderId);
      const totalBalanceWithUtxos = await this.kaspaFacade.getWalletBalanceAndUtxos(order.walletSequenceId);

      if (totalBalanceWithUtxos.totalBalance > 0 || totalBalanceWithUtxos.utxoEntries.length) {
        // no need to await to release user
        this.handleOrderWithMoneyAndNoBuyer(order).catch((err) => this.logger.error(err));

        return { success: false };
      }

      const sellOrderDm: OrderDm = await this.p2pOrderBookService.assignBuyerToOrder(orderId, buyerWalletAddress);
      const temporaryWalletPublicAddress: string = await this.kaspaFacade.getAccountWalletAddressAtIndex(
        sellOrderDm.walletSequenceId,
      );

      return P2pOrderBookResponseTransformer.transformOrderDmToBuyResponseDto(sellOrderDm, temporaryWalletPublicAddress);
    } catch (error) {
      if (this.p2pOrderBookService.isOrderInvalidStatusUpdateError(error)) {
        return { success: false };
      } else {
        throw error;
      }
    }
  }

  public async confirmSell(sellOrderId: string): Promise<ConfirmSellOrderRequestResponseDto> {
    const order: P2pOrderEntity = await this.p2pOrderBookService.getOrderById(sellOrderId);

    const temporaryWalletPublicAddress = await this.kaspaFacade.getAccountWalletAddressAtIndex(order.walletSequenceId);

    const confirmed: boolean = await this.kaspaFacade.checkIfWalletHasKrc20Token(
      temporaryWalletPublicAddress,
      order.ticker,
      order.quantity,
    );

    if (confirmed) {
      await this.p2pOrderBookService.setReadyForSale(order._id);
    }

    return {
      confirmed,
    };
  }

  private async completeSwap(order: P2pOrderEntity): Promise<SwapTransactionsResult> {
    try {
      const transactionsResult = await this.kaspaFacade.doSellSwap(order, async (result) => {
        await this.p2pOrderBookService.updateSwapTransactionsResult(order._id, result);
      });
      await this.p2pOrderBookService.setOrderCompleted(order._id);

      // don't await because not important
      this.telegramBotService.notifyOrderCompleted(order).catch(() => {});
      this.kaspianoBackendApiService.sendMailAfterSwap(order._id).catch((err) => {
        console.error(err);
      });

      return transactionsResult;
    } catch (error) {
      if (error instanceof PriorityFeeTooHighError) {
        await this.p2pOrderBookService.setLowFeeErrorStatus(order._id);
      } else {
        await this.p2pOrderBookService.setSwapError(order._id, error.toString());
        this.logger.error(error?.message, error?.stack);
        this.telegramBotService.sendErrorToErrorsChannel(error);
      }

      throw error;
    }
  }

  public async confirmBuy(sellOrderId: string, confirmBuyDto: ConfirmBuyRequestDto): Promise<ConfirmBuyOrderRequestResponseDto> {
    const order: P2pOrderEntity = await this.p2pOrderBookService.getOrderById(sellOrderId);

    const temporaryWalletPublicAddress = await this.kaspaFacade.getAccountWalletAddressAtIndex(order.walletSequenceId);

    const isVerified: boolean = await this.kaspaFacade.verifyTransactionResultWithKaspaApiAndWalletTotalAmountWithSwapFee(
      confirmBuyDto.transactionId,
      order.buyerWalletAddress,
      temporaryWalletPublicAddress,
      order.totalPrice,
    );

    let transactionsResult: SwapTransactionsResult;

    if (isVerified) {
      const order: P2pOrderEntity = await this.p2pOrderBookService.updateOrderStatusToCheckout(sellOrderId);

      try {
        transactionsResult = await this.completeSwap(order);
      } catch (error) {
        console.error('Failed to do sell swap', error);

        if (error instanceof PriorityFeeTooHighError) {
          return {
            confirmed: false,
            priorityFeeTooHigh: true,
          };
        } else {
          throw error;
        }
      }
    }

    return {
      confirmed: isVerified,
      transactions: transactionsResult,
    };
  }

  public async getOrderStatus(sellOrderId: string, walletAddress: string): Promise<GetOrderStatusResponseDto> {
    const order: P2pOrderEntity = await this.p2pOrderBookService.getOrderById(sellOrderId);

    if (!(order.sellerWalletAddress == walletAddress || order.buyerWalletAddress == walletAddress)) {
      throw new UnauthorizedException('Order does not belong to wallet');
    }

    return {
      status: order.status,
      transactionsData: order.transactions,
    };
  }

  public async confirmDelistSale(
    sellOrderId: string,
    confirmDelistRequestDto: ConfirmDelistRequestDto,
    walletAddress: string,
  ): Promise<ConfirmDelistOrderRequestResponseDto> {
    const order: P2pOrderEntity = await this.p2pOrderBookService.getOrderAndValidateWalletAddress(sellOrderId, walletAddress);

    if (order.status != SellOrderStatus.OFF_MARKETPLACE) {
      throw new Error('Order is not on off marketplace');
    }

    const temporaryWalletPublicAddress = await this.kaspaFacade.getAccountWalletAddressAtIndex(order.walletSequenceId);

    let transactionId = confirmDelistRequestDto.transactionId;

    if (isEmptyString(transactionId)) {
      const walletTotalBalanceAndUtxos: TotalBalanceWithUtxosInterface =
        await this.kaspaNetworkActionsService.getWalletTotalBalanceAndUtxos(temporaryWalletPublicAddress);

      if (walletTotalBalanceAndUtxos.totalBalance === 0n) {
        return {
          confirmed: false,
          needMoney: true,
          temporaryWalletAddress: temporaryWalletPublicAddress,
        };
      }

      if (walletTotalBalanceAndUtxos.utxoEntries.length !== 1) {
        await this.p2pOrderBookService.setUnknownMoneyErrorStatus(order._id);
        const unknownMoneyError = new UnknownMoneyError(walletTotalBalanceAndUtxos.totalBalance, order);
        this.logger.error(unknownMoneyError.message, unknownMoneyError.stack);
        this.telegramBotService.sendErrorToErrorsChannel(unknownMoneyError);
        throw unknownMoneyError;
      }

      transactionId = walletTotalBalanceAndUtxos.utxoEntries[0].outpoint.transactionId;
    }

    const isVerified: boolean = await this.kaspaFacade.verifyTransactionResultWithKaspaApiAndWalletTotalAmountWithSwapFee(
      transactionId,
      order.sellerWalletAddress,
      temporaryWalletPublicAddress,
      0, // swap fee added in verifyTransactionResultWithKaspaApiAndWalletTotalAmountWithSwapFee
    );

    let transactionsResult: Partial<SwapTransactionsResult>;

    if (isVerified) {
      const order: P2pOrderEntity = await this.p2pOrderBookService.confirmDelist(sellOrderId);

      try {
        transactionsResult = await this.delistSellOrder(order);
      } catch (error) {
        if (error instanceof PriorityFeeTooHighError) {
          return {
            confirmed: false,
            priorityFeeTooHigh: true,
          };
        } else {
          throw error;
        }
      }
    }

    return {
      confirmed: isVerified,
      transactions: transactionsResult,
    };
  }

  public async delistSellOrder(order: P2pOrderEntity) {
    try {
      const transactionsResult = await this.kaspaFacade.delistSellSwap(order, async (result) => {
        await this.p2pOrderBookService.updateSwapTransactionsResult(order._id, result);
      });
      await this.p2pOrderBookService.setOrderCompleted(order._id, true);

      return transactionsResult;
    } catch (error) {
      if (error instanceof PriorityFeeTooHighError) {
        await this.p2pOrderBookService.setLowFeeErrorStatus(order._id, true);
      } else {
        this.logger.error(error?.message, error?.stack);
        this.telegramBotService.sendErrorToErrorsChannel(error);
        await this.p2pOrderBookService.setDelistError(order._id, error.toString());
      }

      throw error;
    }
  }

  async releaseBuyLock(sellOrderId: string, walletAddress: string): Promise<void> {
    const order: P2pOrderEntity = await this.p2pOrderBookService.getOrderById(sellOrderId);

    if (order.buyerWalletAddress != walletAddress) {
      throw new UnauthorizedException('Order does not belong to wallet');
    }

    if (!P2pOrderHelper.isOrderInBuyLock(order.status)) {
      throw new HttpException('Order is not in a cancelable status', HttpStatus.BAD_REQUEST);
    }

    const temporaryWalletPublicAddress = await this.kaspaFacade.getAccountWalletAddressAtIndex(order.walletSequenceId);

    const walletTotalBalance: bigint = await this.kaspaNetworkActionsService.getWalletTotalBalance(temporaryWalletPublicAddress);

    if (walletTotalBalance > 0n) {
      throw new Error('Wallet has money in it, cannot release buy lock');
    }

    await this.p2pOrderBookService.releaseBuyLock(sellOrderId);
  }

  async removeSellOrderFromMarketplace(sellOrderId: string, walletAddress: string): Promise<OffMarketplaceRequestResponseDto> {
    try {
      const order: P2pOrderEntity = await this.p2pOrderBookService.getOrderAndValidateWalletAddress(sellOrderId, walletAddress);
      const totalBalanceWithUtxos = await this.kaspaFacade.getWalletBalanceAndUtxos(order.walletSequenceId);

      if (totalBalanceWithUtxos.totalBalance > 0 || totalBalanceWithUtxos.utxoEntries.length) {
        // no need to await to release user
        this.handleOrderWithMoneyAndNoBuyer(order).catch((err) => this.logger.error(err));

        return { success: false };
      }

      const sellOrderDm: OrderDm = await this.p2pOrderBookService.removeSellOrderFromMarketplace(sellOrderId, walletAddress);

      return P2pOrderBookResponseTransformer.transformOrderDmToOffMerketplaceResponseDto(sellOrderDm);
    } catch (error) {
      if (error instanceof InvalidStatusForOrderUpdateError) {
        return {
          success: false,
        };
      }
    }
  }

  async updateSellOrder(sellOrderId: string, updateSellOrderDto: UpdateSellOrderDto, walletAddress: string): Promise<void> {
    const order: P2pOrderEntity = await this.p2pOrderBookService.getOrderAndValidateWalletAddress(sellOrderId, walletAddress);

    const totalBalanceWithUtxos = await this.kaspaFacade.getWalletBalanceAndUtxos(order.walletSequenceId);

    if (totalBalanceWithUtxos.totalBalance > 0 || totalBalanceWithUtxos.utxoEntries.length) {
      // no need to await to release user
      this.handleOrderWithMoneyAndNoBuyer(order).catch((err) => this.logger.error(err));

      throw new HttpException('Order is not in a updatable status', HttpStatus.BAD_REQUEST);
    }

    if (order.status !== SellOrderStatus.OFF_MARKETPLACE) {
      throw new HttpException('Order is not in a updatable status', HttpStatus.BAD_REQUEST);
    }

    await this.p2pOrderBookService.updateSellOrder(sellOrderId, updateSellOrderDto);
  }

  async relistSellOrder(sellOrderId: string, walletAddress: string): Promise<void> {
    const order: P2pOrderEntity = await this.p2pOrderBookService.getOrderAndValidateWalletAddress(sellOrderId, walletAddress);

    if (order.status !== SellOrderStatus.OFF_MARKETPLACE) {
      throw new HttpException('Order is not off market', HttpStatus.BAD_REQUEST);
    }

    await this.p2pOrderBookService.relistSellOrder(sellOrderId);
  }

  async handleOrderWithMoneyAndNoBuyer(order: P2pOrderEntity) {
    try {
      const walletTotalBalanceAndUtxos = await this.kaspaFacade.getWalletBalanceAndUtxos(order.walletSequenceId);

      if (
        walletTotalBalanceAndUtxos.utxoEntries.length == 1 &&
        (await this.kaspaFacade.checkIfWalletHasValidKaspaAmountForSwap(order))
      ) {
        const senderAddr = await this.kaspaFacade.getUtxoSenderWallet(
          await this.kaspaFacade.getAccountWalletAddressAtIndex(order.walletSequenceId),
          walletTotalBalanceAndUtxos.utxoEntries[0],
        );

        if (senderAddr) {
          if (order.status == SellOrderStatus.OFF_MARKETPLACE) {
            await this.p2pOrderBookService.relistSellOrder(order._id);
          }

          await this.p2pOrderBookService.assignBuyerToOrder(order._id, senderAddr);

          await this.confirmBuy(order._id, { transactionId: walletTotalBalanceAndUtxos.utxoEntries[0].outpoint.transactionId });
          return;
        }
      }

      await this.p2pOrderBookService.setUnknownMoneyErrorStatus(order._id);
      const unknownMoneyError = new UnknownMoneyError(walletTotalBalanceAndUtxos.totalBalance, order);
      this.logger.error(unknownMoneyError.message, unknownMoneyError.stack);
      this.telegramBotService.sendErrorToErrorsChannel(unknownMoneyError);
    } catch (error) {
      this.logger.error(error?.message, error?.stack);
      this.telegramBotService.sendErrorToErrorsChannel(error);
    }
  }

  // ===============================================================
  // CRON JOB ACTIONS
  // ===============================================================

  async handleExpiredOrders() {
    const orders = await this.p2pOrderBookService.getExpiredOrders();

    if (orders.length > 0) {
      this.logger.info(`Handling expired orders - ${orders.length} orders found`);
    }

    for (const order of orders) {
      try {
        await this.handleExpiredOrder(order);
      } catch (error) {
        console.error('Failed in handling expired orders', error);

        if (!(error instanceof PriorityFeeTooHighError)) {
          this.logger.error(error?.message, error?.stack);
          this.telegramBotService.sendErrorToErrorsChannel(error);
        }
      }
    }
  }

  async handleWaitingTokensOrders() {
    const orders = await this.p2pOrderBookService.getWaitingForTokensOrders();

    if (orders.length > 0) {
      this.logger.info(`Handling waiting for token orders - ${orders.length} orders found`);
    }

    for (const order of orders) {
      try {
        await this.handleWaitingTokensOrder(order);
      } catch (error) {
        console.error('Failed in handling waiting for token orders', error);

        if (!(error instanceof PriorityFeeTooHighError)) {
          this.logger.error(error?.message, error?.stack);
          this.telegramBotService.sendErrorToErrorsChannel(error);
        }
      }
    }
  }

  async handleWatingForFeeOrders() {
    const orders = await this.p2pOrderBookService.getWaitingForFeesOrders();

    if (orders.length > 0) {
      this.logger.info(`Handling wating for fee orders - ${orders.length} orders found`);
    }

    for (const order of orders) {
      try {
        await this.handleWatingForFeeOrder(order);
      } catch (error) {
        console.error('Failed in handling wating for fee order', error);
      }
    }
  }

  async handleExpiredOrder(order: P2pOrderEntity) {
    const temporaryWalletPublicAddress = await this.kaspaFacade.getAccountWalletAddressAtIndex(order.walletSequenceId);

    await this.p2pOrderBookService.setOrderInCheckingExpired(order);

    const walletTotalBalanceAndUtxos: TotalBalanceWithUtxosInterface =
      await this.kaspaNetworkActionsService.getWalletTotalBalanceAndUtxos(temporaryWalletPublicAddress);

    if (walletTotalBalanceAndUtxos.totalBalance === 0n) {
      await this.p2pOrderBookService.releaseBuyLock(order._id, true);
    } else {
      const setUnknownMoneyError = async () => {
        await this.p2pOrderBookService.setUnknownMoneyErrorStatus(order._id);
        const unknownMoneyError = new UnknownMoneyError(walletTotalBalanceAndUtxos.totalBalance, order);
        this.logger.error(unknownMoneyError.message, unknownMoneyError.stack);
        this.telegramBotService.sendErrorToErrorsChannel(unknownMoneyError);
        throw unknownMoneyError;
      };

      if (walletTotalBalanceAndUtxos.utxoEntries.length !== 1) {
        await setUnknownMoneyError();
      }

      const transactionId = walletTotalBalanceAndUtxos.utxoEntries[0].outpoint.transactionId;

      await this.p2pOrderBookService.setWaitingForKasStatus(order._id, new Date(), null, true);
      const result = await this.confirmBuy(order._id, { transactionId });

      if (!result.confirmed && !result.priorityFeeTooHigh) {
        await setUnknownMoneyError();
      }
    }
  }

  async handleWaitingTokensOrder(order: P2pOrderEntity) {
    const temporaryWalletPublicAddress = await this.kaspaFacade.getAccountWalletAddressAtIndex(order.walletSequenceId);

    const hasTokens: boolean = await this.kaspaFacade.checkIfWalletHasKrc20Token(
      temporaryWalletPublicAddress,
      order.ticker,
      order.quantity,
    );

    if (hasTokens) {
      await this.p2pOrderBookService.setReadyForSale(order._id);
    } else {
      await this.p2pOrderBookService.setTokensNotSent(order._id);
    }
  }

  async handleWatingForFeeOrder(order: P2pOrderEntity) {
    if (order.isDelist) {
      await this.p2pOrderBookService.confirmDelist(order._id, true);
      await this.delistSellOrder(order);
    } else {
      await this.p2pOrderBookService.updateOrderStatusToCheckout(order._id, true);
      await this.completeSwap(order);
    }
  }

  async getOrdersHistory(getOrdersHistoryDto: GetOrdersHistoryDto, walletAddress: string): Promise<GetOrdersHistoryResponseDto> {
    const ordersResponse = await this.p2pOrderBookService.getOrdersHistory(
      getOrdersHistoryDto.filters,
      getOrdersHistoryDto.sort,
      getOrdersHistoryDto.pagination,
      walletAddress,
    );

    return {
      allTickers: ordersResponse.allTickers,
      orders: ordersResponse.orders.map((order) => P2pOrderBookResponseTransformer.transformToOrderHistoryOrder(order)),
      totalCount: ordersResponse.totalCount,
    };
  }

  async notifyStuckOrders() {
    const orders = await this.p2pOrderBookService.getStuckOrders();

    if (orders.length > 0) {
      console.error(`STUCK ORDERS - ${orders.length} orders found: ${orders.map((order) => order._id).join(', ')}`);
      this.logger.error(`STUCK ORDERS - ${orders.length} orders found: ${orders.map((order) => order._id).join(', ')}`);
      await this.telegramBotService.sendErrorToErrorsChannel(new StuckOrdersError(orders));
    }
  }
}
