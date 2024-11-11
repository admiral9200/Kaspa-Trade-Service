import { Injectable } from '@nestjs/common';
import { BaseRepository } from './base.repository';
import { LunchpadEntity } from '../model/schemas/lunchpad.schema';
import { InjectModel } from '@nestjs/mongoose';
import { MONGO_DATABASE_CONNECTIONS } from '../constants';
import { ClientSession, FilterQuery, Model } from 'mongoose';
import { LunchpadOrderStatus, LunchpadStatus } from '../model/enums/lunchpad-statuses.enum';
import { InvalidStatusForLunchpadUpdateError } from '../services/kaspa-network/errors/InvalidStatusForLunchpadUpdate';
import { LunchpadOrder } from '../model/schemas/lunchpad-order.schema';
import { LunchpadNotEnoughAvailableQtyError } from '../services/kaspa-network/errors/LunchpadNotEnoughAvailableQtyError';
import { InvalidStatusForLunchpadOrderUpdateError } from '../services/kaspa-network/errors/InvalidStatusForLunchpadOrderUpdate';
import { KRC20ActionTransations } from '../services/kaspa-network/interfaces/Krc20ActionTransactions.interface';

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
        console.log('Failed assigning status, already in progress');
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

  async stopLunchpadIfNotRunning(lunchpadId: string): Promise<LunchpadEntity> {
    return await super.updateByOne(
      '_id',
      lunchpadId,
      { status: LunchpadStatus.INACTIVE },
      { isRunning: false, status: LunchpadStatus.STOPPING },
    );
  }

  async setLunchpadIsRunning(id: string, isRunning: boolean, session?: ClientSession): Promise<LunchpadEntity> {
    try {
      const additionalData = isRunning ? { status: LunchpadStatus.ACTIVE } : {};
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

      const amountToReduce = Math.min(units, lockedLunchpad.availabeUnits);

      if (!amountToReduce) {
        throw new LunchpadNotEnoughAvailableQtyError(lockedLunchpad._id);
      }

      const updateStatus = {};

      if (lockedLunchpad.availabeUnits - amountToReduce < lockedLunchpad.minUnitsPerOrder * lockedLunchpad.tokenPerUnit) {
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

      if (lockedLunchpad.availabeUnits == 0 && amountToAdd > 0) {
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

  async getOrdersByRoundAndStatus(roundNumber: number, status: LunchpadOrderStatus): Promise<LunchpadOrder[]> {
    return await this.lunchpadOrderModel.find({ roundNumber, status }).exec();
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
}
