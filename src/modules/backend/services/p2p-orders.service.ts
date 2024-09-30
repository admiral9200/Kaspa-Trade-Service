import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { OrderDm } from '../model/dms/order.dm';
import { SellOrdersBookRepository } from '../repositories/sell-orders-book.repository';
import { P2pOrderEntity } from '../model/schemas/p2p-order.schema';
import { P2pOrderBookTransformer } from '../transformers/p2p-order-book.transformer';
import { SellOrderStatus } from '../model/enums/sell-order-status.enum';
import { ClientSession, Connection } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';
import { MONGO_DATABASE_CONNECTIONS } from '../constants';
import { P2P_ORDER_EXPIRATION_TIME_MINUTES } from '../constants/p2p-order.constants';
import { SellOrderDto } from '../model/dtos/sell-order.dto';
import { GetOrdersDto } from '../model/dtos/get-orders.dto';
import { UpdateSellOrderDto } from '../model/dtos/update-sell-order.dto';
import { SwapTransactionsResult } from './kaspa-network/interfaces/SwapTransactionsResult.interface';
import { SortDto } from '../model/dtos/abstract/sort.dto';
import { PaginationDto } from '../model/dtos/abstract/pagination.dto';
import { GetOrdersHistoryFiltersDto } from '../model/dtos/get-orders-history-filters.dto';
import { OrdersManagementUpdateSellOrderDto } from '../model/dtos/orders-management-update-sell-order.dto';
import { isEmptyString } from '../utils/object.utils';

@Injectable()
export class P2pOrdersService {
  constructor(
    @InjectConnection(MONGO_DATABASE_CONNECTIONS.P2P) private connection: Connection,
    private readonly sellOrdersBookRepository: SellOrdersBookRepository,
  ) {}

  public async getSellOrders(ticker: string, getSellOrdersDto: GetOrdersDto): Promise<{ orders: OrderDm[]; totalCount: number }> {
    return await this.sellOrdersBookRepository.getListedSellOrders(
      ticker,
      getSellOrdersDto.walletAddress,
      getSellOrdersDto.sort,
      getSellOrdersDto.pagination,
    );
  }
  public async getUserListings(getSellOrdersDto: GetOrdersDto): Promise<{ orders: OrderDm[]; totalCount: number }> {
    return await this.sellOrdersBookRepository.getUserListedSellOrders(
      getSellOrdersDto.walletAddress,
      [SellOrderStatus.LISTED_FOR_SALE, SellOrderStatus.OFF_MARKETPLACE],
      getSellOrdersDto.sort,
      getSellOrdersDto.pagination,
    );
  }

  public async createSell(sellOrderDto: SellOrderDto, walletSequenceId: number): Promise<P2pOrderEntity> {
    try {
      const sellOrder: P2pOrderEntity = P2pOrderBookTransformer.createP2pOrderEntityFromSellOrderDto(
        sellOrderDto,
        walletSequenceId,
      );

      return await this.sellOrdersBookRepository.createSellOrder(sellOrder);
    } catch (err) {
      throw new HttpException('Failed to create a new sell order', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  public async setWaitingForKasStatus(
    orderId: string,
    expiresAt: Date,
    session?: ClientSession,
    fromExpired: boolean = false,
  ): Promise<P2pOrderEntity> {
    return await this.sellOrdersBookRepository.setWaitingForKasStatus(orderId, expiresAt, session, fromExpired);
  }

  public async assignBuyerToOrder(orderId: string, buyerWalletAddress: string): Promise<P2pOrderEntity> {
    const session: ClientSession = await this.connection.startSession();
    session.startTransaction();

    try {
      const expiresAt: Date = new Date(new Date().getTime() + P2P_ORDER_EXPIRATION_TIME_MINUTES * 60000);
      const sellOrder: P2pOrderEntity = await this.setWaitingForKasStatus(orderId, expiresAt, session);

      const buyerWalletAssigned: boolean = await this.sellOrdersBookRepository.setBuyerWalletAddress(
        orderId,
        buyerWalletAddress,
        session,
      );

      if (!buyerWalletAssigned) {
        console.log('Failed to assign buyer wallet address');
        throw new HttpException('Failed to assign buyer wallet address', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      await session.commitTransaction();

      return sellOrder;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    }
  }

  public async setOrderInCheckingExpired(order: P2pOrderEntity): Promise<P2pOrderEntity> {
    const session: ClientSession = await this.connection.startSession();
    session.startTransaction();

    try {
      const sellOrder: P2pOrderEntity = await this.sellOrdersBookRepository.transitionOrderStatus(
        order._id,
        SellOrderStatus.CHECKING_EXPIRED,
        SellOrderStatus.WAITING_FOR_KAS,
        {},
        session,
      );

      await session.commitTransaction();

      return sellOrder;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    }
  }

  public async getOrderById(sellOrderId: string): Promise<P2pOrderEntity> {
    const order: P2pOrderEntity = await this.sellOrdersBookRepository.getById(sellOrderId);
    if (!order) {
      throw new HttpException('Sell order not found', HttpStatus.NOT_FOUND);
    }

    return order;
  }

  public async setReadyForSale(orderId: string): Promise<void> {
    try {
      await this.sellOrdersBookRepository.transitionOrderStatus(
        orderId,
        SellOrderStatus.LISTED_FOR_SALE,
        SellOrderStatus.WAITING_FOR_TOKENS,
      );
    } catch (error) {
      console.log('Failed to set order status to ready for sale', error);
      throw new HttpException('Failed to set order status to ready for sale', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async updateOrderStatusToCheckout(sellOrderId: string, fromLowFee: boolean = false): Promise<P2pOrderEntity> {
    // FROM HERE, MEANS VALIDATION PASSED
    const order: P2pOrderEntity = await this.sellOrdersBookRepository.setCheckoutStatus(sellOrderId, fromLowFee);
    if (!order) {
      throw new HttpException('Sell order is not in the matching status, cannot confirm buy.', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return order;
  }

  async confirmDelist(sellOrderId: string, fromLowFee: boolean = false): Promise<P2pOrderEntity> {
    // FROM HERE, MEANS VALIDATION PASSED
    return await this.sellOrdersBookRepository.setDelistStatus(sellOrderId, fromLowFee);
  }

  async setOrderCompleted(sellOrderId: string, isDelisting: boolean = false) {
    try {
      await this.sellOrdersBookRepository.setOrderCompleted(sellOrderId, isDelisting);
    } catch (error) {
      console.log('Failed to set order status completed, but swap was successful', error);
    }
  }

  async getExpiredOrders() {
    return await this.sellOrdersBookRepository.getExpiredOrders();
  }

  async getWaitingForFeesOrders() {
    return await this.sellOrdersBookRepository.getWaitingForFeesOrders();
  }

  async getOrderAndValidateWalletAddress(sellOrderId: string, walletAddress: string): Promise<P2pOrderEntity> {
    const order: P2pOrderEntity = await this.sellOrdersBookRepository.getById(sellOrderId);

    if (!order) {
      throw new HttpException('Sell order not found', HttpStatus.NOT_FOUND);
    }

    if (order.sellerWalletAddress != walletAddress) {
      throw new HttpException('Wallet address is not of seller', HttpStatus.BAD_REQUEST);
    }

    return order;
  }

  async removeSellOrderFromMarketplace(sellOrderId: string, walletAddress: string): Promise<P2pOrderEntity> {
    await this.getOrderAndValidateWalletAddress(sellOrderId, walletAddress);

    const session: ClientSession = await this.connection.startSession();
    session.startTransaction();

    try {
      const sellOrder: P2pOrderEntity = await this.sellOrdersBookRepository.setDelistWaitingForKasStatus(sellOrderId, session);

      await session.commitTransaction();

      return sellOrder;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    }
  }

  async releaseBuyLock(sellOrderId: string, fromExpired: boolean = false) {
    await this.sellOrdersBookRepository.transitionOrderStatus(
      sellOrderId,
      SellOrderStatus.LISTED_FOR_SALE,
      fromExpired ? SellOrderStatus.CHECKING_EXPIRED : SellOrderStatus.WAITING_FOR_KAS,
      { buyerWalletAddress: null },
    );
  }

  async setSwapError(sellOrderId: string, error: string) {
    return await this.sellOrdersBookRepository.setSwapError(sellOrderId, error);
  }

  async setLowFeeErrorStatus(sellOrderId: string) {
    return await this.sellOrdersBookRepository.setLowFeeStatus(sellOrderId);
  }

  async setDelistError(sellOrderId: string, error: string) {
    return await this.sellOrdersBookRepository.setDelistError(sellOrderId, error);
  }

  async setExpiredUnknownMoneyErrorStatus(sellOrderId: string) {
    return await this.sellOrdersBookRepository.setExpiredUnknownMoneyErrorStatus(sellOrderId);
  }

  isOrderInvalidStatusUpdateError(error: Error) {
    return this.sellOrdersBookRepository.isOrderInvalidStatusUpdateError(error);
  }

  async updateSellOrder(sellOrderId: string, updateSellOrderDto: UpdateSellOrderDto): Promise<void> {
    await this.sellOrdersBookRepository.updateSellOrderPrices(
      sellOrderId,
      updateSellOrderDto.totalPrice,
      updateSellOrderDto.pricePerToken,
    );
  }

  async relistSellOrder(sellOrderId: string): Promise<void> {
    await this.sellOrdersBookRepository.relistSellOrder(sellOrderId);
  }

  async updateSwapTransactionsResult(sellOrderId: string, result: Partial<SwapTransactionsResult>): Promise<void> {
    await this.sellOrdersBookRepository.updateSwapTransactionsResult(sellOrderId, result);
  }

  async getOrdersHistory(filters: GetOrdersHistoryFiltersDto, sort: SortDto, pagination: PaginationDto) {
    try {
      return await this.sellOrdersBookRepository.getOrdersHistory(filters, sort, pagination);
    } catch (error) {
      throw new HttpException('Failed to get orders history', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async updateOrderFromOrdersManagement(
    orderId: string,
    updateSellOrderDto: OrdersManagementUpdateSellOrderDto,
  ): Promise<P2pOrderEntity> {
    const dataToUpdate: OrdersManagementUpdateSellOrderDto = {
      status: updateSellOrderDto.status,
      transactions: updateSellOrderDto.transactions,
    };

    Object.keys(dataToUpdate.transactions).forEach((key) => {
      if (isEmptyString(dataToUpdate.transactions[key])) {
        dataToUpdate.transactions[key] = null;
      }
    });

    return this.sellOrdersBookRepository.updateOrderFromOrdersManagement(orderId, dataToUpdate);
  }

  async setWalletKeyExposedBy(order: P2pOrderEntity, viewerWallet: string) {
    await this.sellOrdersBookRepository.setWalletKeyExposedBy(order, viewerWallet);
  }
}
