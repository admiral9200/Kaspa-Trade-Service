import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { SellOrderDto } from '../model/dtos/sell-order.dto';
import { P2pOrdersService } from '../services/p2p-orders.service';
import { P2pOrderBookTransformer } from '../transformers/p2p-order-book.transformer';
import { OrderDm } from '../model/dms/order.dm';
import { P2pOrderBookResponseTransformer } from '../transformers/p2p-order-book-response.transformer';
import { ConfirmSellOrderRequestResponseDto } from '../model/dtos/responses/confirm-sell-order-request.response.dto';
import { BuyRequestResponseDto } from '../model/dtos/responses/buy-request.response.dto';
import { SellRequestResponseDto } from '../model/dtos/responses/sell-request.response.dto';
import { ConfirmBuyOrderRequestResponseDto } from '../model/dtos/responses/confirm-buy-order-request.response.dto';
import { KaspaNetworkActionsService } from '../services/kaspa-network/kaspa-network-actions.service';
import { BuyRequestDto } from '../model/dtos/buy-request.dto';
import { KaspaFacade } from '../facades/kaspa.facade';
import { TemporaryWalletSequenceService } from '../services/temporary-wallet-sequence.service';
import { P2pOrderEntity } from '../model/schemas/p2p-order.schema';
import { ConfirmBuyRequestDto } from '../model/dtos/confirm-buy-request.dto';
import { GetOrdersDto } from '../model/dtos/get-orders.dto';
import { ListedOrderDto } from '../model/dtos/listed-order.dto';
import { SwapTransactionsResult } from '../services/kaspa-network/interfaces/SwapTransactionsResult.interface';
import { PriorityFeeTooHighError } from '../services/kaspa-network/errors/PriorityFeeTooHighError';
import { ConfirmDelistRequestDto } from '../model/dtos/confirm-delist-request.dto';
import { ConfirmDelistOrderRequestResponseDto } from '../model/dtos/responses/confirm-delist-order-request.response.dto copy';
import { CancelSwapTransactionsResult } from '../services/kaspa-network/interfaces/CancelSwapTransactionsResult.interface';
import { InvalidStatusForOrderUpdateError } from '../services/kaspa-network/errors/InvalidStatusForOrderUpdate';
import { OffMarketplaceRequestResponseDto } from '../model/dtos/responses/off-marketplace-request.response.dto';
import { UpdateSellOrderDto } from '../model/dtos/update-sell-order.dto';
import { SellOrderStatus } from '../model/enums/sell-order-status.enum';
import { RelistSellOrderDto } from '../model/dtos/relist-sell-order.dto';
import { GetOrdersHistoryDto } from '../model/dtos/get-orders-history.dto';
import { GetOrdersHistoryResponseDto } from '../model/dtos/get-orders-history-response.dto';

@Injectable()
export class P2pProvider {
  constructor(
    private readonly kaspaFacade: KaspaFacade,
    private readonly p2pOrderBookService: P2pOrdersService,
    private readonly temporaryWalletService: TemporaryWalletSequenceService,
    private readonly kaspaNetworkActionsService: KaspaNetworkActionsService,
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

  public async userListings(getSellOrdersRequestDto: GetOrdersDto): Promise<ListedOrderDto[]> {
    const orders: OrderDm[] = await this.p2pOrderBookService.getUserListings(getSellOrdersRequestDto);
    return orders.map((order) => P2pOrderBookTransformer.transformP2pOrderEntityToListedOrderDto(order));
  }

  public async createOrder(sellOrderDto: SellOrderDto): Promise<SellRequestResponseDto> {
    const walletSequenceId: number = await this.temporaryWalletService.getNextSequenceId();

    const createdOrderEntity: P2pOrderEntity = await this.p2pOrderBookService.createSell(sellOrderDto, walletSequenceId);
    const temporaryWalletPublicAddress: string = await this.kaspaFacade.getAccountWalletAddressAtIndex(walletSequenceId);

    return P2pOrderBookResponseTransformer.createSellOrderCreatedResponseDto(createdOrderEntity, temporaryWalletPublicAddress);
  }

  async getCurrentFeeRate() {
    return await this.kaspaNetworkActionsService.getCurrentFeeRate();
  }

  async generateMasterWallet() {
    return await this.kaspaNetworkActionsService.generateMasterWallet();
  }

  public async buy(orderId: string, buyRequestDto: BuyRequestDto): Promise<BuyRequestResponseDto> {
    try {
      const sellOrderDm: OrderDm = await this.p2pOrderBookService.assignBuyerToOrder(orderId, buyRequestDto.walletAddress);
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
      const transactionsResult = await this.kaspaFacade.doSellSwap(order);
      await this.p2pOrderBookService.setOrderCompleted(order._id);

      return transactionsResult;
    } catch (error) {
      if (error instanceof PriorityFeeTooHighError) {
        await this.p2pOrderBookService.setLowFeeErrorStatus(order._id);
      } else {
        await this.p2pOrderBookService.setSwapError(order._id, error.toString());
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

  public async confirmDelistSale(
    sellOrderId: string,
    confirmDelistRequestDto: ConfirmDelistRequestDto,
  ): Promise<ConfirmDelistOrderRequestResponseDto> {
    const order: P2pOrderEntity = await this.p2pOrderBookService.getOrderAndValidateWalletAddress(
      sellOrderId,
      confirmDelistRequestDto.walletAddress,
    );

    const temporaryWalletPublicAddress = await this.kaspaFacade.getAccountWalletAddressAtIndex(order.walletSequenceId);

    const isVerified: boolean = await this.kaspaFacade.verifyTransactionResultWithKaspaApiAndWalletTotalAmountWithSwapFee(
      confirmDelistRequestDto.transactionId,
      order.sellerWalletAddress,
      temporaryWalletPublicAddress,
      0, // swap fee added in verifyTransactionResultWithKaspaApiAndWalletTotalAmountWithSwapFee
    );

    let transactionsResult: CancelSwapTransactionsResult;

    if (isVerified) {
      const order: P2pOrderEntity = await this.p2pOrderBookService.confirmDelist(sellOrderId);

      try {
        transactionsResult = await this.kaspaFacade.delistSellSwap(order);
        await this.p2pOrderBookService.setOrderCompleted(sellOrderId, true);
      } catch (error) {
        console.error('Failed to delist sell order', error);

        if (error instanceof PriorityFeeTooHighError) {
          return {
            confirmed: false,
            priorityFeeTooHigh: true,
          };
        } else {
          await this.p2pOrderBookService.setDelistError(sellOrderId, error.toString());

          throw error;
        }
      }
    }

    return {
      confirmed: isVerified,
      transactions: transactionsResult,
    };
  }

  async releaseBuyLock(sellOrderId: string) {
    await this.p2pOrderBookService.releaseBuyLock(sellOrderId);
  }

  async removeSellOrderFromMarketplace(sellOrderId: string, walletAddress: string): Promise<OffMarketplaceRequestResponseDto> {
    try {
      const sellOrderDm: OrderDm = await this.p2pOrderBookService.removeSellOrderFromMarketplace(sellOrderId, walletAddress);
      const temporaryWalletPublicAddress: string = await this.kaspaFacade.getAccountWalletAddressAtIndex(
        sellOrderDm.walletSequenceId,
      );

      return P2pOrderBookResponseTransformer.transformOrderDmToOffMerketplaceResponseDto(
        sellOrderDm,
        temporaryWalletPublicAddress,
      );
    } catch (error) {
      if (error instanceof InvalidStatusForOrderUpdateError) {
        return {
          success: false,
        };
      }
    }
  }

  async updateSellOrder(sellOrderId: string, updateSellOrderDto: UpdateSellOrderDto): Promise<void> {
    const order: P2pOrderEntity = await this.p2pOrderBookService.getOrderAndValidateWalletAddress(
      sellOrderId,
      updateSellOrderDto.walletAddress,
    );

    if (order.status !== SellOrderStatus.OFF_MARKETPLACE) {
      throw new HttpException('Order is not in a updatable status', HttpStatus.BAD_REQUEST);
    }

    await this.p2pOrderBookService.updateSellOrder(sellOrderId, updateSellOrderDto);
  }

  async relistSellOrder(sellOrderId: string, relistSellOrderDto: RelistSellOrderDto) {
    const order: P2pOrderEntity = await this.p2pOrderBookService.getOrderAndValidateWalletAddress(
      sellOrderId,
      relistSellOrderDto.walletAddress,
    );

    if (order.status !== SellOrderStatus.OFF_MARKETPLACE) {
      throw new HttpException('Order is not off market', HttpStatus.BAD_REQUEST);
    }

    await this.p2pOrderBookService.relistSellOrder(sellOrderId);
  }

  async handleExpiredOrders() {
    const orders = await this.p2pOrderBookService.getExpiredOrders();

    for (const order of orders) {
      try {
        await this.handleExpiredOrder(order);
      } catch (error) {
        console.error('Failed in handling expired orders', error);
      }
    }
  }

  async handleWatingForFeeOrders() {
    const orders = await this.p2pOrderBookService.getWaitingForFeesOrders();

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

    const walletTotalBalance: bigint = await this.kaspaNetworkActionsService.getWalletTotalBalance(temporaryWalletPublicAddress);

    if (walletTotalBalance === 0n) {
      await this.p2pOrderBookService.setReadyForSale(order._id, true);
    } else {
      const transactionId = null; // TODO: get transaction id from kaspa api

      if (!transactionId) {
        await this.p2pOrderBookService.setExpiredUnknownMoneyErrorStatus(order._id);
        throw new Error('Unkonwn money');
      }

      await this.p2pOrderBookService.setWaitingForKasStatus(order._id, new Date(), null, true);
      await this.confirmBuy(order._id, { transactionId });
    }
  }

  async handleWatingForFeeOrder(order: P2pOrderEntity) {
    await this.p2pOrderBookService.updateOrderStatusToCheckout(order._id);
    await this.completeSwap(order);
  }

  async getOrdersHistory(getOrdersHistoryDto: GetOrdersHistoryDto): Promise<GetOrdersHistoryResponseDto> {
    const ordersResponse = await this.p2pOrderBookService.getOrdersHistory(
      getOrdersHistoryDto.filters,
      getOrdersHistoryDto.sort,
      getOrdersHistoryDto.pagination,
    );

    return {
      orders: ordersResponse.orders.map((order) => P2pOrderBookResponseTransformer.transformToOrderHistoryOrder(order)),
      totalCount: ordersResponse.totalCount,
    };
  }
}
