import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { SellOrderDm } from '../model/dms/sell-order.dm';
import { SellOrdersBookRepository } from '../repositories/sell-orders-book.repository';
import { P2pOrder } from '../model/schemas/p2p-order.schema';
import { P2pOrderBookTransformer } from '../transformers/p2p-order-book.transformer';
import { KaspaFacade } from '../facades/kaspa.facade';
import { TemporaryWallet } from '../model/schemas/temporary-wallet.schema';
import { P2pTemporaryWalletsRepository } from '../repositories/p2p-temporary-wallets.repository';
import { SellOrderStatus } from '../model/enums/sell-order-status.enum';
import { ClientSession, Connection } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';
import { MONGO_DATABASE_CONNECTIONS } from '../constants';
import { P2P_ORDER_EXPIRATION_TIME_MINUTES } from '../constants/p2p-order.constants';
import { SortDto } from '../model/dtos/abstract/sort.dto';
import { PaginationDto } from '../model/dtos/abstract/pagination.dto';
import { P2pOrderHelper } from '../helpers/p2p-order.helper';

@Injectable()
export class P2pOrdersService {
  constructor(
    @InjectConnection(MONGO_DATABASE_CONNECTIONS.P2P) private connection: Connection,
    private readonly wasmFacade: KaspaFacade,
    private readonly sellOrdersBookRepository: SellOrdersBookRepository,
    private readonly p2pTemporaryWalletsRepository: P2pTemporaryWalletsRepository,
  ) {}

  public async getSellOrders(
    ticker: string,
    walletAddress?: string,
    sort?: SortDto,
    pagination?: PaginationDto,
  ): Promise<SellOrderDm[]> {
    return await this.sellOrdersBookRepository.getListedSellOrders(ticker, walletAddress, sort, pagination);
  }

  public async createSell(sellOrderDm: SellOrderDm, temporaryWallet: TemporaryWallet) {
    try {
      const sellOrder: P2pOrder = P2pOrderBookTransformer.createSellOrder(sellOrderDm, temporaryWallet.walletSequenceId);
      const createdSellOrder = await this.sellOrdersBookRepository.createSellOrder(sellOrder);

      return P2pOrderBookTransformer.transformSellOrderModelToDm(createdSellOrder, temporaryWallet.address);
    } catch (err) {
      throw new HttpException('Failed to create a new sell order', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  public async assignBuyerToOrder(orderId: string, buyerWalletAddress: string): Promise<SellOrderDm> {
    const session: ClientSession = await this.connection.startSession();
    session.startTransaction();

    try {
      const expiresAt: Date = new Date(new Date().getTime() + P2P_ORDER_EXPIRATION_TIME_MINUTES * 60000);
      const sellOrder: P2pOrder = await this.sellOrdersBookRepository.setWaitingForKasStatus(orderId, expiresAt);

      if (!sellOrder) {
        throw new HttpException('Failed assigning buyer, already in progress', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const temporaryWallet: TemporaryWallet = await this.p2pTemporaryWalletsRepository.findOneBy(
        'walletSequenceId',
        sellOrder.walletSequenceId,
      );

      if (!temporaryWallet) {
        throw new HttpException(
          `Temporary wallet not found wallet walletSequenceId(${sellOrder.walletSequenceId})`,
          HttpStatus.NOT_FOUND,
        );
      }

      const buyerWalletAssigned: boolean = await this.sellOrdersBookRepository.setBuyerWalletAddress(orderId, buyerWalletAddress);
      if (!buyerWalletAssigned) {
        throw new HttpException('Failed to assign buyer wallet address', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      await session.commitTransaction();

      return P2pOrderBookTransformer.transformSellOrderModelToDm(sellOrder, temporaryWallet.address);
    } catch (error) {
      await session.abortTransaction();
      throw error;
    }
  }

  public async getOrderById(sellOrderId: string): Promise<P2pOrder> {
    const order: P2pOrder = await this.sellOrdersBookRepository.getById(sellOrderId);
    if (!order) {
      throw new HttpException('Sell order not found', HttpStatus.NOT_FOUND);
    }

    return order;
  }

  public async setReadyForSale(orderId: string) {
    await this.sellOrdersBookRepository.transitionOrderStatus(
      orderId,
      SellOrderStatus.LISTED_FOR_SALE,
      SellOrderStatus.WAITING_FOR_TOKENS,
    );
  }

  async confirmBuy(sellOrderId: string): Promise<P2pOrder> {
    // FROM HERE, MEANS VALIDATION PASSED
    const order: P2pOrder = await this.sellOrdersBookRepository.setCheckoutStatus(sellOrderId);
    if (!order) {
      throw new HttpException('Sell order is not in the matching status, cannot confirm buy.', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return order;
  }

  async setOrderCompleted(sellOrderId: string) {
    try {
      await this.sellOrdersBookRepository.setStatus(sellOrderId, SellOrderStatus.COMPLETED);
    } catch (error) {
      console.log('Failed to set order status completed, but swap was successful', error);
    }
  }

  async cancelExpiredOrders() {
    await this.sellOrdersBookRepository.updateAndGetExpiredOrders();
  }

  async cancelSellOrder(sellOrderId: string) {
    const order: P2pOrder = await this.getOrderById(sellOrderId);

    if (!P2pOrderHelper.isOrderCancelable(order.status)) {
      throw new HttpException('Order is not in a cancelable status', HttpStatus.BAD_REQUEST);
    }

    await this.sellOrdersBookRepository.transitionOrderStatus(sellOrderId, SellOrderStatus.CANCELED, order.status);
  }
}
