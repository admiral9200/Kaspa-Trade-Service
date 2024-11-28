import { Injectable } from '@nestjs/common';
import { BaseRepository } from './base.repository';
import { LunchpadEntity, LunchpadRound } from '../model/schemas/lunchpad.schema';
import { InjectModel } from '@nestjs/mongoose';
import { MONGO_DATABASE_CONNECTIONS } from '../constants';
import { ClientSession, FilterQuery, Model } from 'mongoose';
import { LunchpadOrderStatus, LunchpadStatus } from '../model/enums/lunchpad-statuses.enum';
import { InvalidStatusForLunchpadUpdateError } from '../services/kaspa-network/errors/InvalidStatusForLunchpadUpdate';
import { LunchpadOrder } from '../model/schemas/lunchpad-order.schema';
import { LunchpadNotEnoughAvailableQtyError } from '../services/kaspa-network/errors/LunchpadNotEnoughAvailableQtyError';
import { InvalidStatusForLunchpadOrderUpdateError } from '../services/kaspa-network/errors/InvalidStatusForLunchpadOrderUpdate';
import { KRC20ActionTransations } from '../services/kaspa-network/interfaces/Krc20ActionTransactions.interface';
import { GetLunchpadListFiltersDto } from '../model/dtos/lunchpad/get-lunchpad-list';
import { SortDto } from '../model/dtos/abstract/sort.dto';
import { PaginationDto } from '../model/dtos/abstract/pagination.dto';
import { LunchpadNotEnoughUserAvailableQtyError } from '../services/kaspa-network/errors/LunchpadNotEnoughUserAvailableQtyError';
import { GetLunchpadOrderListFiltersDto } from '../model/dtos/lunchpad/get-lunchpad-order-list';
import { GetUserLunchpadOrderListFiltersDto } from '../model/dtos/lunchpad/get-user-lunchpad-order-list';

const WAITING_FOR_KAS_TIME_TO_CHECK = 10 * 60 * 1000;

export interface LunchpadOrderWithLunchpad extends LunchpadOrder {
  lunchpad: LunchpadEntity;
}

@Injectable()
export class LunchpadRepository extends BaseRepository<LunchpadEntity> {
  constructor(
    @InjectModel(LunchpadEntity.name, MONGO_DATABASE_CONNECTIONS.P2P)
    private readonly lunchpadModel: Model<LunchpadEntity>,
    @InjectModel(LunchpadOrder.name, MONGO_DATABASE_CONNECTIONS.P2P)
    private readonly lunchpadOrderModel: Model<LunchpadOrder>,
  ) {
    super(lunchpadModel);
  }

  async updateLunchpadByStatus(
    id: string,
    data: Partial<LunchpadEntity>,
    requiredStatus: LunchpadStatus,
    session?: ClientSession,
  ): Promise<LunchpadEntity> {
    try {
      const result = await super.updateByOne('_id', id, data, { status: requiredStatus }, session);

      if (!result) {
        console.log('Failed assigning lunchpad status, requested stats: ' + requiredStatus);
        throw new InvalidStatusForLunchpadUpdateError();
      }

      return result;
    } catch (error) {
      if (!this.isLunchpadInvalidStatusUpdateError(error)) {
        console.error(`Error updating to status for lunchpad by ID(${id}):`, error);
      }

      throw error;
    }
  }

  async updateLunchpadByOwnerAndStatus(
    id: string,
    data: Partial<LunchpadEntity>,
    requiredStatuses: LunchpadStatus[],
    ownerWalletAddress: string,
    session?: ClientSession,
  ): Promise<LunchpadEntity> {
    try {
      const result = await super.updateByOne(
        '_id',
        id,
        data,
        { status: { $in: requiredStatuses }, ownerWallet: ownerWalletAddress },
        session,
      );

      if (!result) {
        console.log(
          'Failed updateing lunchpad by owner, requested status: ' +
            requiredStatuses.join(requiredStatuses.join(',')) +
            ', owner: ' +
            ownerWalletAddress +
            ', id: ' +
            id,
        );
        throw new InvalidStatusForLunchpadUpdateError();
      }

      return result;
    } catch (error) {
      if (!this.isLunchpadInvalidStatusUpdateError(error)) {
        console.error(`Error updating lunchpad by ID(${id}):`, error);
      }

      throw error;
    }
  }

  async stopLunchpadIfNotRunning(lunchpadId: string, roundsData: LunchpadRound[]): Promise<LunchpadEntity> {
    return await super.updateByOne(
      '_id',
      lunchpadId,
      { status: LunchpadStatus.INACTIVE, rounds: roundsData, totalUnits: 0, availabeUnits: 0 },
      { isRunning: false, status: LunchpadStatus.STOPPING },
    );
  }

  async setLunchpadIsRunning(
    id: string,
    isRunning: boolean,
    lunchpadStatus: LunchpadStatus = LunchpadStatus.ACTIVE,
    session?: ClientSession,
  ): Promise<LunchpadEntity> {
    if (isRunning && ![LunchpadStatus.ACTIVE, LunchpadStatus.STOPPING, LunchpadStatus.NO_UNITS_LEFT].includes(lunchpadStatus)) {
      throw new InvalidStatusForLunchpadUpdateError();
    }
    try {
      const additionalData = isRunning ? { status: lunchpadStatus } : {};
      const result = await super.updateByOne('_id', id, { isRunning }, { isRunning: !isRunning, ...additionalData }, session);

      if (!result) {
        console.log('Failed assigning is running, already in progress');
        throw new InvalidStatusForLunchpadUpdateError();
      }

      return result;
    } catch (error) {
      if (!this.isLunchpadInvalidStatusUpdateError(error)) {
        console.error(`Error updating IsRunning to for Lunchpad id (${id}):`, error);
      }

      throw error;
    }
  }

  async updateOrderUserTransactionId(lunchpadOrderId: string, transactionId: string): Promise<LunchpadOrder> {
    return await this.lunchpadOrderModel
      .findOneAndUpdate({ _id: lunchpadOrderId }, { $set: { userTransactionId: transactionId } }, { new: true })
      .exec();
  }

  public isLunchpadInvalidStatusUpdateError(error) {
    return error instanceof InvalidStatusForLunchpadUpdateError || this.isDocumentTransactionLockedError(error);
  }

  async getWalletBoughtUntisForLunchpad(lunchpadId: string, walletAddress: string): Promise<number> {
    const result = await this.lunchpadOrderModel
      .aggregate([
        {
          $match: {
            lunchpadId,
            userWalletAddress: walletAddress,
            status: { $ne: LunchpadOrderStatus.TOKENS_NOT_SENT },
          },
        },
        {
          $group: {
            _id: null,
            totalUnits: { $sum: '$totalUnits' },
          },
        },
      ])
      .exec();

    return result[0]?.totalUnits || 0;
  }

  async createLunchpadOrderAndLockLunchpadQty(
    lunchpadId: string,
    units: number,
    orderCreatorWallet: string,
  ): Promise<{ lunchpad: LunchpadEntity; lunchpadOrder: LunchpadOrder }> {
    const session = await this.connection.startSession();

    session.startTransaction();

    try {
      const lockedLunchpad = await this.lunchpadModel.findOneAndUpdate(
        { _id: lunchpadId },
        { $inc: { availabeUnits: 0 } }, // No-op, essentially locks the document
        { new: true, session }, // Use session to ensure it's part of the transaction
      );

      if (!lockedLunchpad) {
        throw new Error('Lunchpad not found');
      }

      let amountToReduce = Math.min(units, lockedLunchpad.availabeUnits);

      if (lockedLunchpad.maxUnitsPerWallet) {
        const walletUnits = await this.getWalletBoughtUntisForLunchpad(lockedLunchpad.id, orderCreatorWallet);

        console.log('getWalletBoughtUntisForLunchpad', walletUnits);

        const remainingUnitsAvailable = lockedLunchpad.maxUnitsPerWallet - walletUnits;

        if (remainingUnitsAvailable <= 0) {
          throw new LunchpadNotEnoughUserAvailableQtyError(lockedLunchpad._id, orderCreatorWallet);
        }

        amountToReduce = Math.min(amountToReduce, remainingUnitsAvailable);
      }

      if (!amountToReduce) {
        throw new LunchpadNotEnoughAvailableQtyError(lockedLunchpad._id);
      }

      const updateStatus = {};

      console.log({ lunchpadId, units, orderCreatorWallet, lockedLunchpad, amountToReduce });

      if (lockedLunchpad.availabeUnits - amountToReduce < lockedLunchpad.minUnitsPerOrder) {
        updateStatus['$set'] = { status: LunchpadStatus.NO_UNITS_LEFT };
      }

      const updatedLunchpad = await this.lunchpadModel.findOneAndUpdate(
        { _id: lockedLunchpad._id },
        { $inc: { availabeUnits: -amountToReduce }, ...updateStatus }, // Decrease the quantity
        { new: true, session }, // Use session for the transaction
      );

      const lunchpadOrder = await this.lunchpadOrderModel.create({
        lunchpadId,
        status: LunchpadOrderStatus.WAITING_FOR_KAS,
        totalUnits: amountToReduce,
        userWalletAddress: orderCreatorWallet,
        roundNumber: updatedLunchpad.roundNumber,
      });

      session.commitTransaction();

      return {
        lunchpad: updatedLunchpad,
        lunchpadOrder: lunchpadOrder,
      };
    } catch (error) {
      await session.abortTransaction();

      throw error;
    }
  }

  async cancelLunchpadOrderAndLockLunchpadQty(
    lunchpadId: string,
    orderId: string,
  ): Promise<{ lunchpad: LunchpadEntity; lunchpadOrder: LunchpadOrder }> {
    const session = await this.connection.startSession();

    session.startTransaction();

    try {
      const lockedLunchpad = await this.lunchpadModel.findOneAndUpdate(
        { _id: lunchpadId },
        { $inc: { availabeUnits: 0 } }, // No-op, essentially locks the document
        { new: true, session }, // Use session to ensure it's part of the transaction
      );

      if (!lockedLunchpad) {
        throw new Error('Lunchpad not found');
      }

      const updatedOrder = await this.transitionLunchpadOrderStatus(
        orderId,
        LunchpadOrderStatus.TOKENS_NOT_SENT,
        LunchpadOrderStatus.WAITING_FOR_KAS,
      );

      const amountToAdd = updatedOrder.totalUnits;

      const updateStatus = {};

      if (
        lockedLunchpad.status == LunchpadStatus.NO_UNITS_LEFT &&
        lockedLunchpad.availabeUnits + amountToAdd >= lockedLunchpad.minUnitsPerOrder
      ) {
        updateStatus['$set'] = { status: LunchpadStatus.ACTIVE };
      }

      const updatedLunchpad = await this.lunchpadModel.findOneAndUpdate(
        { _id: lockedLunchpad._id },
        { $inc: { availabeUnits: amountToAdd }, ...updateStatus }, // Decrease the quantity
        { new: true, session }, // Use session for the transaction
      );

      session.commitTransaction();

      return {
        lunchpad: updatedLunchpad,
        lunchpadOrder: updatedOrder,
      };
    } catch (error) {
      await session.abortTransaction();

      throw error;
    }
  }

  async transitionLunchpadOrderStatus(
    orderId: string,
    newStatus: LunchpadOrderStatus,
    requiredStatus: LunchpadOrderStatus,
    additionalData: Partial<LunchpadOrder> = {},
    session?: ClientSession,
  ): Promise<LunchpadOrder> {
    try {
      const filter: FilterQuery<LunchpadOrder> = {
        status: requiredStatus,
        _id: orderId,
      };

      const updatedOrder = await this.lunchpadOrderModel
        .findOneAndUpdate(filter, { $set: { status: newStatus, ...additionalData } }, { new: true })
        .session(session)
        .exec();

      if (!updatedOrder) {
        throw new InvalidStatusForLunchpadOrderUpdateError();
      }

      return updatedOrder;
    } catch (error) {
      if (!this.isLunchpadInvalidStatusUpdateError(error)) {
        console.error(`Error updating to ${newStatus} for order by ID(${orderId}):`, error);
      }

      throw error;
    }
  }

  async findOrderByIdAndWalletAddress(orderId: string, walletAddress: string): Promise<LunchpadOrder | null> {
    return this.lunchpadOrderModel.findOne({ _id: orderId, userWalletAddress: walletAddress });
  }

  async updateOrderTransactionsResult(
    orderId: string,
    transactionsResult: Partial<KRC20ActionTransations>,
  ): Promise<LunchpadOrder> {
    try {
      return await this.lunchpadOrderModel
        .findOneAndUpdate(
          { _id: orderId },
          {
            $set: {
              transactions: transactionsResult,
            },
          },
        )
        .exec();
    } catch (error) {
      throw error;
    }
  }

  async reduceLunchpadTokenCurrentAmount(lunchpadId: string, amountToReduce: number): Promise<LunchpadEntity> {
    try {
      return await this.lunchpadModel
        .findOneAndUpdate({ _id: lunchpadId }, { $inc: { currentTokensAmount: -amountToReduce } }, { new: true })
        .exec();
    } catch (error) {
      throw error;
    }
  }
  async getOrdersByRoundAndStatuses(
    lunchpadId: string,
    roundNumber: number,
    statuses: LunchpadOrderStatus[],
    orderBy?: { [key: string]: 1 | -1 },
  ): Promise<LunchpadOrder[]> {
    const query = this.lunchpadOrderModel.find({ lunchpadId, roundNumber, status: { $in: statuses } });

    if (orderBy) {
      query.sort(orderBy);
    }

    return await query.exec();
  }

  async setWalletKeyExposedBy(lunchpad: LunchpadEntity, viewerWallet: string, walletType: string) {
    return await this.updateByOne('_id', lunchpad._id, {
      walletKeyExposedBy: (lunchpad.walletKeyExposedBy || []).concat([
        {
          wallet: viewerWallet,
          type: walletType,
          timestamp: Date.now(),
        },
      ]),
    });
  }

  async getLunchpadList(
    filters: GetLunchpadListFiltersDto,
    sort: SortDto,
    pagination: PaginationDto,
    walletAddress?: string,
  ): Promise<{ lunchpads: LunchpadEntity[]; totalCount: number }> {
    const filterQuery: any = {};

    // Filters
    if (filters) {
      if (filters.ownerOnly && walletAddress) {
        filterQuery.ownerWallet = walletAddress;
      }

      if (filters.statuses && filters.statuses.length > 0) {
        filterQuery.status = { $in: filters.statuses };
      }

      if (filters.tickers && filters.tickers.length > 0) {
        filterQuery.ticker = { $in: filters.tickers };
      }

      // if (filters.startDateTimestamp || filters.endDateTimestamp) {
      //   filterQuery.createdAt = {};
      //   if (filters.startDateTimestamp) {
      //     filterQuery.createdAt.$gte = new Date(filters.startDateTimestamp);
      //   }
      //   if (filters.endDateTimestamp) {
      //     filterQuery.createdAt.$lte = new Date(filters.endDateTimestamp);
      //   }
      // }
    }

    // Create the base query
    let query: any = this.lunchpadModel.find(filterQuery);

    console.log(filterQuery);

    // Apply sorting
    query = this.applySort(query, sort);

    // Get total count before pagination
    const totalCount = await this.lunchpadModel.countDocuments(filterQuery);

    // Apply pagination
    query = this.applyPagination(query, pagination);

    // Execute the query
    const lunchpads = await query.exec();

    return { lunchpads, totalCount };
  }

  /**
   * Gets all lunchpad orders that are waiting for kas too long
   */
  async getLunchpadIdsWithWaitingForKasTooLongOrders(): Promise<string[]> {
    const now = new Date();
    const tooLongAgo = new Date(now.getTime() - WAITING_FOR_KAS_TIME_TO_CHECK);

    const lunchpadIds = await this.lunchpadOrderModel.distinct('lunchpadId', {
      createdAt: { $lte: tooLongAgo },
      status: LunchpadOrderStatus.WAITING_FOR_KAS,
    });

    return lunchpadIds;
  }

  async getOrdersUsedTransactionsForLunchpad(lunchpadId: string) {
    const orders = await this.lunchpadOrderModel.find(
      { lunchpadId, userTransactionId: { $exists: true } },
      { userTransactionId: 1 },
    );
    return orders.map((order) => order.userTransactionId).filter((id) => id);
  }

  async getMatchingwaitingForKasOrderByUnitsAndWallet(
    lunchpad: LunchpadEntity,
    units: number,
    walletAddress: string,
  ): Promise<LunchpadOrder | null> {
    return await this.lunchpadOrderModel
      .findOne({
        lunchpadId: lunchpad._id,
        units,
        wallet: walletAddress,
        roundNumber: lunchpad.roundNumber,
        status: LunchpadOrderStatus.WAITING_FOR_KAS,
      })
      .sort({ createdAt: 1 })
      .exec();
  }

  async getLunchpadWaitingForKasOrders(lunchpadId: string): Promise<LunchpadOrder[]> {
    return await this.lunchpadOrderModel
      .find({
        lunchpadId,
        status: LunchpadOrderStatus.WAITING_FOR_KAS,
      })
      .sort({ createdAt: 1 })
      .exec();
  }

  async getLunchpadOrders(
    lunchpadId: string,
    filters: GetLunchpadOrderListFiltersDto,
    sort: SortDto,
    pagination: PaginationDto,
  ): Promise<{ orders: LunchpadOrder[]; totalCount: number }> {
    const filterQuery: any = { lunchpadId };

    if (filters) {
      if (filters.statuses && filters.statuses.length > 0) {
        filterQuery.status = { $in: filters.statuses };
      }

      if (filters.roundNumber) {
        filterQuery.roundNumber = filters.roundNumber;
      }

      if (filters.startDateTimestamp || filters.endDateTimestamp) {
        filterQuery.createdAt = {};
        if (filters.startDateTimestamp) {
          filterQuery.createdAt.$gte = new Date(filters.startDateTimestamp);
        }
        if (filters.endDateTimestamp) {
          filterQuery.createdAt.$lte = new Date(filters.endDateTimestamp);
        }
      }
    }

    // Create the base query
    let query: any = this.lunchpadOrderModel.find(filterQuery);
    const totalCount = await this.lunchpadOrderModel.countDocuments(filterQuery);

    // Apply sorting
    query = this.applySort(query, sort);

    // Apply pagination
    query = this.applyPagination(query, pagination);

    // Execute the query
    const orders = await query.exec();

    return { orders, totalCount };
  }

  async getLunchpadsForOrdersWithStatus(statuses: LunchpadOrderStatus[]): Promise<LunchpadEntity[]> {
    return await this.lunchpadOrderModel
      .aggregate([
        {
          $match: {
            status: { $in: statuses },
          },
        },
        {
          $group: {
            _id: '$lunchpadId', // Group by lunchpadId
          },
        },
        { $addFields: { convertedId: { $toObjectId: '$_id' } } }, // Convert if needed
        {
          $lookup: {
            from: this.lunchpadModel.collection.name, // The name of the lunchpad collection
            localField: 'convertedId', // The field from lunchpadOrderModel
            foreignField: '_id', // The field in lunchpadModel to match
            as: 'lunchpadData', // The resulting array field
          },
        },
        {
          $unwind: '$lunchpadData', // Flatten the results
        },
        {
          $replaceRoot: { newRoot: '$lunchpadData' }, // Replace root with the lunchpad data
        },
        {
          $match: {
            isRunning: false,
          },
        },
      ])
      .exec();
  }

  async getLunchpadOrdersForWallet(
    walletAddress: string,
    filters: GetUserLunchpadOrderListFiltersDto,
    sort: SortDto,
    pagination: PaginationDto,
  ): Promise<{ orders: LunchpadOrderWithLunchpad[]; tickers: string[]; totalCount: number }> {
    const filterQuery: any = { userWalletAddress: walletAddress };

    const tickersQuery = await this.lunchpadOrderModel
      .aggregate([
        { $match: filterQuery }, // Apply the initial filter
        { $addFields: { convertedId: { $toObjectId: '$lunchpadId' } } }, // Convert if needed
        {
          $lookup: {
            from: this.lunchpadModel.collection.name, // Join with lunchpad collection
            localField: 'convertedId',
            foreignField: '_id',
            as: 'lunchpad',
          },
        },
        { $unwind: '$lunchpad' }, // Flatten the joined data
        {
          $group: {
            _id: '$lunchpad.ticker', // Group by the ticker field
          },
        },
        {
          $project: {
            ticker: '$_id', // Project only the ticker field
            _id: 0, // Exclude the `_id` field from the result
          },
        },
      ])
      .exec();

    if (filters) {
      if (filters.statuses && filters.statuses.length > 0) {
        filterQuery.status = { $in: filters.statuses };
      }

      if (filters.roundNumber) {
        filterQuery.roundNumber = filters.roundNumber;
      }

      if (filters.startDateTimestamp || filters.endDateTimestamp) {
        filterQuery.createdAt = {};
        if (filters.startDateTimestamp) {
          filterQuery.createdAt.$gte = new Date(filters.startDateTimestamp);
        }
        if (filters.endDateTimestamp) {
          filterQuery.createdAt.$lte = new Date(filters.endDateTimestamp);
        }
      }
    }

    // Aggregation pipeline
    const pipeline: any[] = [
      // Match orders based on filters
      { $match: filterQuery },
      { $addFields: { convertedId: { $toObjectId: '$lunchpadId' } } }, // Convert if needed
      // Join with the lunchpad collection
      {
        $lookup: {
          from: this.lunchpadModel.collection.name,
          localField: 'convertedId',
          foreignField: '_id',
          as: 'lunchpad',
        },
      },
      { $unwind: '$lunchpad' }, // Unwind the joined data
    ];

    if (filters.tickers && filters.tickers.length > 0) {
      pipeline.push({ $match: { 'lunchpad.ticker': { $in: filters.tickers } } });
    }

    // Create the base query
    // const orders = await this.lunchpadOrderModel.aggregate(pipeline).exec();

    // let query: any = this.lunchpadOrderModel.find(filterQuery);
    const totalCountQuery = await this.lunchpadOrderModel.aggregate([...pipeline, { $count: 'totalCount' }]).exec();
    const totalCount = totalCountQuery[0]?.totalCount || 0;

    // Apply sorting
    pipeline.push(this.applySortPipeline(sort));
    pipeline.push(...this.applyPaginationPipeline(pagination));

    // Execute the query
    const orders = await this.lunchpadOrderModel.aggregate(pipeline).exec();

    return { orders, tickers: tickersQuery.map((l) => l.ticker), totalCount };
  }
}
