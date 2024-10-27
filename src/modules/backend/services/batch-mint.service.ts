import { Injectable } from '@nestjs/common';
import { BatchMintRepository } from '../repositories/batch-mint.repository';
import { UtilsHelper } from '../helpers/utils.helper';
import { BatchMintStatus } from '../model/enums/batch-mint-statuses.enum';
import { KRC20ActionTransations } from './kaspa-network/interfaces/Krc20ActionTransactions.interface';
import { BatchMintEntity } from '../model/schemas/batch-mint.schema';

@Injectable()
export class BatchMintService {
  constructor(
    private readonly batchMintRepository: BatchMintRepository,
    private readonly utils: UtilsHelper,
  ) {}

  async getByIdAndWallet(id: string, wallet: string) {
    return this.batchMintRepository.findOne({ _id: id, ownerWallet: wallet });
  }

  async create(ticker: string, amount: number, ownerWallet: string, walletSequenceId: number, maxPriorityFee: number) {
    this.batchMintRepository.create({
      ticker,
      ownerWallet,
      totalMints: amount,
      finishedMints: 0,
      maxPriorityFee,
      status: BatchMintStatus.CREATED,
      walletSequenceId,
    });
  }

  async updateMintProgress(entity: BatchMintEntity, transactions: KRC20ActionTransations): Promise<BatchMintEntity> {
    if (transactions.revealTransactionId) {
      return await this.batchMintRepository.finishMintAction(entity, transactions);
    } else {
      return await this.batchMintRepository.addMintAction(entity, transactions);
    }
  }

  async updateStatusToInProgress(id: string): Promise<BatchMintEntity> {
    return await this.batchMintRepository.updateBatchmintByStatus(
      id,
      { status: BatchMintStatus.IN_PROGRESS },
      BatchMintStatus.CREATED,
    );
  }

  async updateStatusToCompleted(id: string, refundTransactionId: string, isMintOver: boolean = false): Promise<BatchMintEntity> {
    return await this.batchMintRepository.updateBatchmintByStatus(
      id,
      { status: isMintOver ? BatchMintStatus.MINT_ENDED : BatchMintStatus.COMPLETED, refundTransactionId },
      BatchMintStatus.IN_PROGRESS,
    );
  }

  async updateStatusToError(id: string, errorMessage: any): Promise<BatchMintEntity> {
    return await this.batchMintRepository.updateByOne('_id', id, { status: BatchMintStatus.ERROR, error: errorMessage });
  }
}
