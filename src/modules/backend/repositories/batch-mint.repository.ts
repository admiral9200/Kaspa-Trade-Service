import { Injectable } from '@nestjs/common';
import { BatchMintEntity } from '../model/schemas/batch-mint.schema';
import { InjectModel } from '@nestjs/mongoose';
import { BaseRepository } from './base.repository';
import { MONGO_DATABASE_CONNECTIONS } from '../constants';
import { ClientSession, Model } from 'mongoose';
import { KRC20ActionTransations } from '../services/kaspa-network/interfaces/Krc20ActionTransactions.interface';
import { BatchMintStatus } from '../model/enums/batch-mint-statuses.enum';
import { InvalidStatusForBatchMintUpdateError } from '../services/kaspa-network/errors/batch-mint/InvalidStatusForBatchMintUpdateError';

@Injectable()
export class BatchMintRepository extends BaseRepository<BatchMintEntity> {
  constructor(
    @InjectModel(BatchMintEntity.name, MONGO_DATABASE_CONNECTIONS.P2P)
    private readonly batchMintModel: Model<BatchMintEntity>,
  ) {
    super(batchMintModel);
  }

  async addMintAction(entity: BatchMintEntity, transactions: KRC20ActionTransations): Promise<BatchMintEntity> {
    return await this.batchMintModel.findByIdAndUpdate(
      entity._id,
      {
        $push: {
          transactions: transactions,
        },
      },
      {
        new: true,
      },
    );
  }

  async finishMintAction(entity: BatchMintEntity, transactions: KRC20ActionTransations): Promise<BatchMintEntity> {
    return await this.batchMintModel.findByIdAndUpdate(
      entity._id,
      {
        $set: {
          'transactions.$[elem]': transactions,
        },
        $inc: { finishedMints: 1 },
      },
      {
        new: true,
        arrayFilters: [{ 'elem.commitTransactionId': transactions.commitTransactionId }],
      },
    );
  }

  async updateBatchmintByStatus(
    id: string,
    data: Partial<BatchMintEntity>,
    requiredStatus: BatchMintStatus,
    session?: ClientSession,
  ): Promise<BatchMintEntity> {
    try {
      const result = await super.updateByOne('_id', id, data, { status: requiredStatus }, session);

      if (!result) {
        console.log('Failed assigning status, already in progress');
        throw new InvalidStatusForBatchMintUpdateError();
      }

      return result;
    } catch (error) {
      if (!this.isBatchMintInvalidStatusUpdateError(error)) {
        console.error(`Error updating to  for order by ID(${id}):`, error);
      }

      throw error;
    }
  }

  public isBatchMintInvalidStatusUpdateError(error) {
    return error instanceof InvalidStatusForBatchMintUpdateError || this.isDocumentTransactionLockedError(error);
  }

  async updateTransferTokenTransactions(entity: BatchMintEntity, transactions: KRC20ActionTransations): Promise<BatchMintEntity> {
    return await this.batchMintModel.findByIdAndUpdate(
      entity._id,
      {
        $set: {
          transferTokenTransactions: transactions,
        },
      },
      {
        new: true,
      },
    );
  }

  async findByWallet(walletAddress: string): Promise<BatchMintEntity[]> {
    return await this.batchMintModel
      .find(
        { ownerWallet: walletAddress },
        {
          _id: 1,
          ticker: 1,
          totalMints: 1,
          finishedMints: 1,
          maxPriorityFee: 1,
          status: 1,
          createdAt: 1,
        },
      )
      .exec();
  }
}
