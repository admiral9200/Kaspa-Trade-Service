import { Injectable } from '@nestjs/common';
import { BatchMintEntity } from '../model/schemas/batch-mint.schema';
import { InjectModel } from '@nestjs/mongoose';
import { BaseRepository } from './base.repository';
import { MONGO_DATABASE_CONNECTIONS } from '../constants';
import { ClientSession, Model } from 'mongoose';
import { KRC20ActionTransations } from '../services/kaspa-network/interfaces/Krc20ActionTransactions.interface';
import { BatchMintStatus } from '../model/enums/batch-mint-statuses.enum';
import { InvalidStatusForBatchMintUpdateError } from '../services/kaspa-network/errors/batch-mint/InvalidStatusForBatchMintUpdateError';
import { GetBatchMintUserListFiltersDto } from '../model/dtos/batch-mint/get-batch-mint-user-list';
import { SortDto } from '../model/dtos/abstract/sort.dto';
import { PaginationDto } from '../model/dtos/abstract/pagination.dto';

const WAITING_FOR_KAS_TOO_LONG_TIME = 10 * 60 * 1000;
const WAITING_FOR_JOB_TOO_LONG_TIME = 10 * 60 * 1000;
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
        throw new InvalidStatusForBatchMintUpdateError(id);
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

  async getWalletBatchMintHistory(
    filters: GetBatchMintUserListFiltersDto,
    sort: SortDto,
    pagination: PaginationDto,
    walletAddress: string,
  ): Promise<{ batchMints: BatchMintEntity[]; totalCount: number; allTickers: string[] }> {
    const filterQuery: any = { ownerWallet: walletAddress };
    const tickerQuery: any = { ownerWallet: walletAddress };

    // Filters
    if (filters) {
      if (filters.statuses && filters.statuses.length > 0) {
        filterQuery.status = { $in: filters.statuses };
      }

      if (filters.tickers && filters.tickers.length > 0) {
        filterQuery.ticker = { $in: filters.tickers };
      }

      if (filters.isReachedMintLimit) {
        filterQuery.isReachedMintLimit = true;
      }

      if (filters.isUserCanceled) {
        filterQuery.isUserCanceled = true;
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
    let query: any = this.batchMintModel.find(filterQuery);

    console.log(filterQuery);

    // Apply sorting
    query = this.applySort(query, sort);

    // Get total count before pagination
    const totalCount = await this.batchMintModel.countDocuments(filterQuery);
    const allTickers = await this.batchMintModel.distinct('ticker', tickerQuery);
    // Apply pagination
    query = this.applyPagination(query, pagination);

    // Execute the query
    const batchMints = await query.exec();

    return { batchMints, totalCount, allTickers };
  }

  async getWaitingForKasTooLongMints(): Promise<BatchMintEntity[]> {
    return await this.batchMintModel
      .find({
        status: BatchMintStatus.CREATED_AND_WAITING_FOR_KAS,
        createdAt: { $lt: new Date(Date.now() - WAITING_FOR_KAS_TOO_LONG_TIME) },
      })
      .exec();
  }

  async getStuckWaitingForJobMints(): Promise<BatchMintEntity[]> {
    return await this.batchMintModel
      .find({
        status: BatchMintStatus.WAITING_FOR_JOB,
        createdAt: { $lt: new Date(Date.now() - WAITING_FOR_JOB_TOO_LONG_TIME) },
      })
      .exec();
  }

  async setWalletKeyExposedBy(batchMint: BatchMintEntity, viewerWallet: string) {
    return await this.updateByOne('_id', batchMint._id, {
      walletKeyExposedBy: (batchMint.walletKeyExposedBy || []).concat([
        {
          wallet: viewerWallet,
          timestamp: Date.now(),
        },
      ]),
    });
  }
}
