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

const WAITING_FOR_KAS_TIME_TO_CHECK = 10 * 60 * 1000;

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
      { status: LunchpadStatus.INACTIVE, rounds: roundsData },
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
        kasPerUnit: updatedLunchpad.kasPerUnit,
        tokenPerUnit: updatedLunchpad.tokenPerUnit,
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
  ): Promise<LunchpadOrder[]> {
    return await this.lunchpadOrderModel.find({ lunchpadId, roundNumber, status: { $in: statuses } }).exec();
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
    walletAddress: string,
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
}
