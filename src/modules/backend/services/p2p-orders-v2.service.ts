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

  async create(sellOrderDto: SellOrderV2Dto, walletAddress: string) {
    return await this.sellOrdersV2Repository.create({
      pricePerToken: sellOrderDto.pricePerToken,
      psktSeller: sellOrderDto.psktSeller,
      quantity: sellOrderDto.quantity,
      sellerWalletAddress: walletAddress,
      ticker: sellOrderDto.ticker,
      totalPrice: sellOrderDto.totalPrice,
      status: SellOrderStatusV2.LISTED_FOR_SALE,
      psktTransactionId: sellOrderDto.psktTransactionId,
    });
  }

  async getById(id: string) {
    return await this.sellOrdersV2Repository.getById(id);
  }

  async updateBuyerAndStatus(orderId: string, buyerWalletAddress: string, transactionId: string, feeAmount: number) {
    const result = await this.sellOrdersV2Repository.updateBuyerAndStatus(orderId, buyerWalletAddress, transactionId, feeAmount);

    if (!result) {
      throw new Error('Incorrect status for buying an order');
    }

    return result;
  }

  async reopenSellOrder(orderId: string) {
    const result = await this.sellOrdersV2Repository.reopenSellOrder(orderId);

    if (!result) {
      throw new Error('Incorrect status for reopening an order');
    }

    return result;
  }

  async setOrderToCompleted(orderId: string) {
    const result = await this.sellOrdersV2Repository.setOrderToCompleted(orderId);

    if (!result) {
      throw new Error('Incorrect status for completing an order');
    }

    return result;
  }

  async cancelSellOrder(orderId: string, ownerWallet: string) {
    const result = await this.sellOrdersV2Repository.cancelSellOrder(orderId, ownerWallet);

    if (!result) {
      throw new Error('Incorrect status for canceling an order');
    }

    return result;
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

  async getSellOrders(ticker: string, sort: SortDto, pagination: PaginationDto) {
    return await this.sellOrdersV2Repository.getOrderListWithOldOrdersAndTotalCount(
      { tickers: [ticker], statuses: [SellOrderStatusV2.LISTED_FOR_SALE] },
      sort,
      pagination,
      false,
    );
  }
}
