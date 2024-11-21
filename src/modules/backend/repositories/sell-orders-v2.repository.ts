import { Injectable } from '@nestjs/common';
import { BaseRepository } from './base.repository';
import { InjectModel } from '@nestjs/mongoose';
import { MONGO_DATABASE_CONNECTIONS } from '../constants';
import { Model } from 'mongoose';
import { P2pOrderV2Entity } from '../model/schemas/p2p-order-v2.schema';
import { SellOrderStatusV2 } from '../model/enums/sell-order-status-v2.enum';
import { P2pOrderEntity } from '../model/schemas/p2p-order.schema';
import { SortDto } from '../model/dtos/abstract/sort.dto';
import { PaginationDto } from '../model/dtos/abstract/pagination.dto';
import { GetOrderListFiltersDto } from '../model/dtos/p2p-orders/get-order-list-filter.dto';
import { SellOrderStatus } from '../model/enums/sell-order-status.enum';

@Injectable()
export class SellOrdersV2Repository extends BaseRepository<P2pOrderV2Entity> {
  constructor(
    @InjectModel(P2pOrderV2Entity.name, MONGO_DATABASE_CONNECTIONS.P2P)
    private readonly sellOrderV2Model: Model<P2pOrderV2Entity>,
    @InjectModel(P2pOrderEntity.name, MONGO_DATABASE_CONNECTIONS.P2P)
    private readonly sellOrderModel: Model<P2pOrderEntity>,
  ) {
    super(sellOrderV2Model);
  }

  async updateBuyerAndStatus(sellOrderId: string, buyerWalletAddress: string, transactionId: string): Promise<P2pOrderV2Entity> {
    return await this.sellOrderV2Model.findOneAndUpdate(
      { _id: sellOrderId, status: SellOrderStatusV2.LISTED_FOR_SALE },
      { $set: { buyerWalletAddress, status: SellOrderStatusV2.VERIFYING, buyerTransactionId: transactionId } },
      { new: true },
    );
  }

  async reopenSellOrder(sellOrderId: string): Promise<P2pOrderV2Entity> {
    return await this.sellOrderV2Model.findOneAndUpdate(
      { _id: sellOrderId, status: SellOrderStatusV2.VERIFYING },
      { $set: { status: SellOrderStatusV2.LISTED_FOR_SALE } },
      { new: true },
    );
  }

  async setOrderToCompleted(sellOrderId: string, commission: number): Promise<P2pOrderV2Entity> {
    return await this.sellOrderV2Model.findOneAndUpdate(
      { _id: sellOrderId, status: SellOrderStatusV2.VERIFYING },
      { $set: { status: SellOrderStatusV2.COMPLETED, feeAmount: commission } },
      { new: true },
    );
  }

  async cancelSellOrder(sellOrderId: string): Promise<P2pOrderV2Entity> {
    return await this.sellOrderV2Model.findOneAndUpdate(
      { _id: sellOrderId, status: SellOrderStatusV2.LISTED_FOR_SALE },
      { $set: { status: SellOrderStatusV2.CANCELED } },
      { new: true },
    );
  }

  private async getOrderListWithOldBasePipeline(filters: GetOrderListFiltersDto) {
    const baseQuery: any = filters.buyerWalletAddress || filters.sellerWalletAddress ? { $or: [] } : {};

    if (filters) {
      if (filters.statuses?.length) {
        baseQuery.status = { $in: filters.statuses };
      } else {
        baseQuery.status = { $nin: [SellOrderStatus.TOKENS_NOT_SENT] };
      }

      if (filters.tickers?.length) {
        baseQuery.ticker = { $in: filters.tickers };
      }

      if (filters.sellerWalletAddress) {
        baseQuery.$or.push({ sellerWalletAddress: filters.sellerWalletAddress });
      }
      if (filters.buyerWalletAddress) {
        baseQuery.$or.push({ buyerWalletAddress: filters.buyerWalletAddress });
      }

      if (filters.totalPrice) {
        const priceFilter: { $gte?: number; $lte?: number } = {};
        if (filters.totalPrice.min) priceFilter.$gte = filters.totalPrice.min;
        if (filters.totalPrice.max) priceFilter.$lte = filters.totalPrice.max;
        if (Object.keys(priceFilter).length) baseQuery.totalPrice = priceFilter;
      }

      if (filters.startDateTimestamp || filters.endDateTimestamp) {
        baseQuery.createdAt = {};
        if (filters.startDateTimestamp) {
          baseQuery.createdAt.$gte = new Date(filters.startDateTimestamp);
        }
        if (filters.endDateTimestamp) {
          baseQuery.createdAt.$lte = new Date(filters.endDateTimestamp);
        }
      }
    }

    const basePipeline: any[] = [
      {
        $addFields: { isDecentralized: true },
      },
      { $match: baseQuery }, // Filters for first collection
      {
        $unionWith: {
          coll: 'p2p_orders', // Name of the second collection
          pipeline: [{ $match: baseQuery }, { $addFields: { isDecentralized: false } }], // Filters for second collection
        },
      },
    ];

    return basePipeline;
  }

  // From old and new
  async getOrderListWithOldOrdersAndTotalCount(
    filters: GetOrderListFiltersDto,
    sort: SortDto,
    pagination: PaginationDto,
    withTickers: boolean = false,
  ): Promise<{ orders: P2pOrderEntity[]; totalCount: number; allTickers?: string[] | null }> {
    const baseQueryPipe = await this.getOrderListWithOldBasePipeline(filters);

    // Count total documents
    const countPipeline = [...baseQueryPipe, { $count: 'totalCount' }];

    // Apply sorting
    if (sort) {
      const sortStage = this.applySortPipeline(sort); // Helper to create $sort stage
      baseQueryPipe.push(sortStage);
    }

    // Apply pagination
    if (pagination) {
      const paginationStages = this.applyPaginationPipeline(pagination); // Helpers for $skip and $limit stages
      baseQueryPipe.push(...paginationStages);
    }

    const result = await this.sellOrderV2Model.aggregate(baseQueryPipe).exec();
    const [countResult] = await this.sellOrderV2Model.aggregate(countPipeline).exec();
    const totalCount = countResult?.totalCount || 0;

    let tickers = null;

    if (withTickers) {
      const tickersPipe = await this.getOrderListWithOldBasePipeline({
        buyerWalletAddress: filters.buyerWalletAddress,
        sellerWalletAddress: filters.sellerWalletAddress,
      });
      // Distinct tickers
      const allTickers = await this.sellOrderV2Model
        .aggregate([...tickersPipe, { $group: { _id: '$ticker' } }, { $project: { _id: 0, ticker: '$_id' } }])
        .exec();

      tickers = allTickers.map((item: { ticker: string }) => item.ticker);
    }

    return { orders: result, totalCount, allTickers: tickers };
  }
}
