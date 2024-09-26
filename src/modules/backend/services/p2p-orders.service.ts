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
import { P2pOrderHelper } from '../helpers/p2p-order.helper';
import { SellOrderDto } from '../model/dtos/sell-order.dto';
import { GetOrdersDto } from '../model/dtos/get-orders.dto';

@Injectable()
export class P2pOrdersService {
  constructor(
    @InjectConnection(MONGO_DATABASE_CONNECTIONS.P2P) private connection: Connection,
    private readonly sellOrdersBookRepository: SellOrdersBookRepository,
  ) {}

  public async getSellOrders(ticker: string, getSellOrdersDto: GetOrdersDto): Promise<OrderDm[]> {
    return await this.sellOrdersBookRepository.getListedSellOrders(
      ticker,
      getSellOrdersDto.walletAddress,
      getSellOrdersDto.sort,
      getSellOrdersDto.pagination,
    );
  }
  public async getUserListings(getSellOrdersDto: GetOrdersDto): Promise<OrderDm[]> {
    return await this.sellOrdersBookRepository.getUserListedSellOrders(
      getSellOrdersDto.walletAddress,
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

  public async assignBuyerToOrder(orderId: string, buyerWalletAddress: string): Promise<P2pOrderEntity> {
    const session: ClientSession = await this.connection.startSession();
    session.startTransaction();

    try {
      const expiresAt: Date = new Date(new Date().getTime() + P2P_ORDER_EXPIRATION_TIME_MINUTES * 60000);
      const sellOrder: P2pOrderEntity = await this.sellOrdersBookRepository.setWaitingForKasStatus(orderId, expiresAt);

      if (!sellOrder) {
        console.log('Failed assigning buyer, already in progress');
        throw new HttpException('Failed assigning buyer, already in progress', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const buyerWalletAssigned: boolean = await this.sellOrdersBookRepository.setBuyerWalletAddress(orderId, buyerWalletAddress);
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

  public async getOrderById(sellOrderId: string): Promise<P2pOrderEntity> {
    const order: P2pOrderEntity = await this.sellOrdersBookRepository.getById(sellOrderId);
    if (!order) {
      throw new HttpException('Sell order not found', HttpStatus.NOT_FOUND);
    }

    return order;
  }

  public async setReadyForSale(orderId: string) {
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

  async confirmBuy(sellOrderId: string): Promise<P2pOrderEntity> {
    // FROM HERE, MEANS VALIDATION PASSED
    const order: P2pOrderEntity = await this.sellOrdersBookRepository.setCheckoutStatus(sellOrderId);
    if (!order) {
      throw new HttpException('Sell order is not in the matching status, cannot confirm buy.', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return order;
  }

  async confirmDelist(sellOrderId: string): Promise<P2pOrderEntity> {
    // FROM HERE, MEANS VALIDATION PASSED
    const order: P2pOrderEntity = await this.sellOrdersBookRepository.setDelistStatus(sellOrderId);
    if (!order) {
      throw new HttpException('Sell order is not in the matching status, cannot delist.', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return order;
  }

  async setOrderCompleted(sellOrderId: string, isDelisting: boolean = false) {
    try {
      await this.sellOrdersBookRepository.setOrderCompleted(sellOrderId, isDelisting);
    } catch (error) {
      console.log('Failed to set order status completed, but swap was successful', error);
    }
  }

  async cancelExpiredOrders() {
    await this.sellOrdersBookRepository.updateAndGetExpiredOrders();
  }

  async delistSellOrder(sellOrderId: string): Promise<P2pOrderEntity> {
    const session: ClientSession = await this.connection.startSession();
    session.startTransaction();

    try {
      const sellOrder: P2pOrderEntity = await this.sellOrdersBookRepository.setDelistWaitingForKasStatus(sellOrderId);

      if (!sellOrder) {
        console.log('Failed in delisting, already in progress');
        throw new HttpException('Failed assigning deisting, already in progress', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      await session.commitTransaction();

      return sellOrder;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    }
  }

  async releaseBuyLock(sellOrderId: string) {
    const order: P2pOrderEntity = await this.getOrderById(sellOrderId);

    if (!P2pOrderHelper.isOrderInBuyLock(order.status)) {
      throw new HttpException('Order is not in a cancelable status', HttpStatus.BAD_REQUEST);
    }

    await this.sellOrdersBookRepository.transitionOrderStatus(
      sellOrderId,
      SellOrderStatus.LISTED_FOR_SALE,
      SellOrderStatus.WAITING_FOR_KAS,
    );
  }

  async setSwapError(sellOrderId: string, error: string) {
    return await this.sellOrdersBookRepository.setSwapError(sellOrderId, error);
  }

  async setDelistError(sellOrderId: string, error: string) {
    return await this.sellOrdersBookRepository.setDelistError(sellOrderId, error);
  }
}
