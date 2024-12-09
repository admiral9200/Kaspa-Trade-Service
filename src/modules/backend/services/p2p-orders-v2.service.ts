import { Injectable } from '@nestjs/common';
import { SellOrdersV2Repository } from '../repositories/sell-orders-v2.repository';
import { SellOrderV2Dto } from '../model/dtos/p2p-orders/sell-order-v2.dto';
import { SellOrderStatusV2 } from '../model/enums/sell-order-status-v2.enum';
import { GetUserOrdersFiltersDto } from '../model/dtos/p2p-orders/get-user-orders-request.dto';
import { SortDto } from '../model/dtos/abstract/sort.dto';
import { PaginationDto } from '../model/dtos/abstract/pagination.dto';
import { GetOrderListFiltersDto } from '../model/dtos/p2p-orders/get-order-list-filter.dto';

@Injectable()
export class P2pOrdersV2Service {
  constructor(private readonly sellOrdersV2Repository: SellOrdersV2Repository) {}

  async create(
    sellOrderDto: SellOrderV2Dto,
    walletAddress: string,
    psktTransactionId: string,
    isPsktVerified: boolean,
    psktFee: number,
  ) {
    return await this.sellOrdersV2Repository.createIfNotExists(
      {
        pricePerToken: sellOrderDto.pricePerToken,
        psktSeller: sellOrderDto.psktSeller,
        quantity: sellOrderDto.quantity,
        sellerWalletAddress: walletAddress,
        ticker: sellOrderDto.ticker,
        totalPrice: sellOrderDto.totalPrice,
        status: isPsktVerified ? SellOrderStatusV2.LISTED_FOR_SALE : SellOrderStatusV2.PSKT_VERIFICATION_ERROR,
        psktTransactionId,
        psktFee,
      },
      'psktSeller',
    );
  }

  async getById(id: string) {
    return await this.sellOrdersV2Repository.getById(id);
  }

  async updateStatusToVerifying(orderId: string) {
    try {
      return await this.sellOrdersV2Repository.transitionOrderStatus(
        orderId,
        SellOrderStatusV2.VERIFYING,
        SellOrderStatusV2.LISTED_FOR_SALE,
      );
    } catch (e) {
      if (this.sellOrdersV2Repository.isOrderInvalidStatusUpdateError(e)) {
        return await this.sellOrdersV2Repository.transitionOrderStatus(
          orderId,
          SellOrderStatusV2.VERIFYING,
          SellOrderStatusV2.FAILED_VERIFICATION,
        );
      }

      throw e;
    }
  }

  isOrderInvalidStatusUpdateError(error: any) {
    return this.sellOrdersV2Repository.isOrderInvalidStatusUpdateError(error);
  }

  async reopenSellOrder(orderId: string) {
    return await this.sellOrdersV2Repository.transitionOrderStatus(
      orderId,
      SellOrderStatusV2.LISTED_FOR_SALE,
      SellOrderStatusV2.VERIFYING,
    );
  }

  async setOrderToCompleted(orderId: string, buyerWalletAddress: string, sendTransactionId: string, commission: number = 0) {
    return await this.sellOrdersV2Repository.transitionOrderStatus(
      orderId,
      SellOrderStatusV2.COMPLETED,
      SellOrderStatusV2.VERIFYING,
      { feeAmount: commission, buyerWalletAddress, sendTransactionId },
    );
  }

  async setOrderToCanceled(orderId: string, sendTransactionId: string) {
    return await this.sellOrdersV2Repository.transitionOrderStatus(
      orderId,
      SellOrderStatusV2.CANCELED,
      SellOrderStatusV2.VERIFYING,
      {
        sendTransactionId,
      },
    );
  }

  async setOrderToFailedVerification(orderId: string) {
    return await this.sellOrdersV2Repository.transitionOrderStatus(
      orderId,
      SellOrderStatusV2.FAILED_VERIFICATION,
      SellOrderStatusV2.VERIFYING,
    );
  }

  async getUserOrders(filters: GetUserOrdersFiltersDto, sort: SortDto, pagination: PaginationDto, walletAddress: string) {
    const repoFilters: GetOrderListFiltersDto = {
      buyerWalletAddress: filters.isBuyer ? walletAddress : null,
      sellerWalletAddress: filters.isSeller ? walletAddress : null,
      endDateTimestamp: filters.endDateTimestamp,
      startDateTimestamp: filters.startDateTimestamp,
      statuses: filters.statuses,
      tickers: filters.tickers,
      totalPrice: filters.totalPrice,
    };

    return await this.sellOrdersV2Repository.getOrderListWithOldOrdersAndTotalCount(repoFilters, sort, pagination, true);
  }

  async getSellOrders(ticker: string, sort: SortDto, pagination: PaginationDto, completedOrders: boolean = false) {
    return await this.sellOrdersV2Repository.getOrderListWithOldOrdersAndTotalCount(
      { tickers: [ticker], statuses: [completedOrders ? SellOrderStatusV2.COMPLETED : SellOrderStatusV2.LISTED_FOR_SALE] },
      sort,
      pagination,
      false,
    );
  }

  async getUserUnlistedTransactions(transactions: string[], walletAddress: string): Promise<string[]> {
    return await this.sellOrdersV2Repository.getUnlistedTransactions(transactions, walletAddress);
  }
}
