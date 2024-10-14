import { Injectable } from '@nestjs/common';
import { BaseRepository } from './base.repository';
import { LunchpadEntity } from '../model/schemas/lunchpad.schema';
import { InjectModel } from '@nestjs/mongoose';
import { MONGO_DATABASE_CONNECTIONS } from '../constants';
import { ClientSession, Model } from 'mongoose';
import { LunchpadOrderStatus, LunchpadStatus } from '../model/enums/lunchpad-statuses.enum';
import { InvalidStatusForLunchpadUpdateError } from '../services/kaspa-network/errors/InvalidStatusForLunchpadUpdate';
import { LunchpadOrder } from '../model/schemas/lunchpad-order.schema';
import { LunchpadNotEnoughAvailableQtyError } from '../services/kaspa-network/errors/LunchpadNotEnoughAvailableQtyError';

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
        console.error(`Error updating to  for order by ID(${id}):`, error);
      }

      throw error;
    }
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

      const updatedLunchpad = await this.lunchpadModel.findOneAndUpdate(
        { _id: lockedLunchpad._id },
        { $inc: { availabeUnits: -amountToReduce } }, // Decrease the quantity
        { new: true, session }, // Use session for the transaction
      );

      const lunchpadOrder = await this.lunchpadOrderModel.create({
        lunchpadId,
        kasPerUnit: updatedLunchpad.kasPerUnit,
        tokenPerUnit: updatedLunchpad.tokenPerUnit,
        status: LunchpadOrderStatus.WAITING_FOR_KAS,
        totalUnits: amountToReduce,
        userWalletAddress: orderCreatorWallet,
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
}
