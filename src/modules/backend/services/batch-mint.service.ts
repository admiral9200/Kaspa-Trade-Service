import { Injectable } from '@nestjs/common';
import { BatchMintRepository } from '../repositories/batch-mint.repository';
import { BatchMintStatus } from '../model/enums/batch-mint-statuses.enum';
import { KRC20ActionTransations } from './kaspa-network/interfaces/Krc20ActionTransactions.interface';
import { BatchMintEntity } from '../model/schemas/batch-mint.schema';
import { GetBatchMintUserListFiltersDto } from '../model/dtos/batch-mint/get-batch-mint-user-list';
import { SortDto } from '../model/dtos/abstract/sort.dto';
import { PaginationDto } from '../model/dtos/abstract/pagination.dto';

@Injectable()
export class BatchMintService {
  constructor(private readonly batchMintRepository: BatchMintRepository) {}

  async getById(id: string) {
    return this.batchMintRepository.findOne({ _id: id });
  }

  async getByIdAndWallet(id: string, wallet: string) {
    return this.batchMintRepository.findOne({ _id: id, ownerWallet: wallet });
  }

  async create(
    ticker: string,
    amount: number,
    ownerWallet: string,
    walletSequenceId: number,
    maxPriorityFee: number,
    stopMintsAtMintsLeft: number,
  ): Promise<BatchMintEntity> {
    return await this.batchMintRepository.create({
      ticker,
      ownerWallet,
      totalMints: amount,
      finishedMints: 0,
      maxPriorityFee,
      status: BatchMintStatus.CREATED_AND_WAITING_FOR_KAS,
      walletSequenceId,
      stopMintsAtMintsLeft,
    });
  }

  async updateMintProgress(entity: BatchMintEntity, transactions: KRC20ActionTransations): Promise<BatchMintEntity> {
    if (transactions.revealTransactionId) {
      return await this.batchMintRepository.finishMintAction(entity, transactions);
    } else {
      return await this.batchMintRepository.addMintAction(entity, transactions);
    }
  }

  async updateTransferTokenTransactions(entity: BatchMintEntity, transactions: KRC20ActionTransations) {
    return await this.batchMintRepository.updateTransferTokenTransactions(entity, transactions);
  }

  async updateStatusToWaitingForJob(id: string, fromError = false): Promise<BatchMintEntity> {
    return await this.batchMintRepository.updateBatchmintByStatus(
      id,
      { status: BatchMintStatus.WAITING_FOR_JOB },
      fromError ? BatchMintStatus.ERROR : BatchMintStatus.CREATED_AND_WAITING_FOR_KAS,
    );
  }

  async updateStatusToInProgress(id: string, fromError = false): Promise<BatchMintEntity> {
    return await this.batchMintRepository.updateBatchmintByStatus(
      id,
      { status: BatchMintStatus.IN_PROGRESS },
      fromError ? BatchMintStatus.ERROR : BatchMintStatus.WAITING_FOR_JOB,
    );
  }

  async updateStatusToCompleted(id: string, refundTransactionId: string, isMintOver: boolean = false): Promise<BatchMintEntity> {
    return await this.batchMintRepository.updateBatchmintByStatus(
      id,
      {
        status: BatchMintStatus.COMPLETED,
        refundTransactionId,
        isReachedMintLimit: isMintOver,
      },
      BatchMintStatus.IN_PROGRESS,
    );
  }

  async updateStatusToError(id: string, errorMessage: any): Promise<BatchMintEntity> {
    return await this.batchMintRepository.updateByOne('_id', id, { status: BatchMintStatus.ERROR, error: errorMessage });
  }

  async updateStatusToPodNotInitializedError(id: string, errorMessage: any): Promise<BatchMintEntity> {
    return await this.batchMintRepository.updateByOne('_id', id, {
      status: BatchMintStatus.POD_NOT_INITIALIZED_ERROR,
      error: errorMessage,
    });
  }

  async isBatchMintInvalidStatusUpdateError(error: any) {
    return this.batchMintRepository.isBatchMintInvalidStatusUpdateError(error);
  }

  async getByWallet(walletAddress: string): Promise<BatchMintEntity[]> {
    return await this.batchMintRepository.findByWallet(walletAddress);
  }

  async cancelBatchMint(id: string): Promise<BatchMintEntity> {
    return await this.batchMintRepository.updateByOne('_id', id, { isUserCanceled: true });
  }

  async getWalletBatchMintHistory(
    filters: GetBatchMintUserListFiltersDto,
    sort: SortDto,
    pagination: PaginationDto,
    walletAddress: string,
  ): Promise<{ batchMints: BatchMintEntity[]; totalCount: number; allTickers: string[] }> {
    return await this.batchMintRepository.getWalletBatchMintHistory(filters, sort, pagination, walletAddress);
  }
}
