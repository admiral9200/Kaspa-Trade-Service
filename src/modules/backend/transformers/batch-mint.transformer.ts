import { BatchMintDataWithErrors, BatchMintListDataWithErrors } from '../model/dtos/batch-mint/batch-mint-data-with-wallet';
import { BatchMintStatus } from '../model/enums/batch-mint-statuses.enum';
import { BatchMintEntity } from '../model/schemas/batch-mint.schema';
import { KRC20ActionTransations } from '../services/kaspa-network/interfaces/Krc20ActionTransactions.interface';

export type ClientSideBatchMint = {
  id: string;
  ticker: string;
  totalMints: number;
  finishedMints: number;
  maxPriorityFee: number;
  status: BatchMintStatus;
  stopMintsAtMintsLeft: number;
  transactions?: Partial<KRC20ActionTransations>[];
  transferTokenTransactions?: Partial<KRC20ActionTransations>;
  refundTransactionId?: string;
  batchMintWalletAddress?: string;
  requiredKaspaAmount?: number;
  isReachedMintLimit?: boolean;
  isUserCanceled?: boolean;
};

export type ClientSideBatchMintListItem = {
  id: string;
  ticker: string;
  totalMints: number;
  finishedMints: number;
  maxPriorityFee: number;
  status: BatchMintStatus;
  stopMintsAtMintsLeft: number;
  isReachedMintLimit: boolean;
  isUserCanceled: boolean;
  createdAt: Date;
};

export type ClientSideBatchMintWithStatus = {
  success: boolean;
  errorCode?: number;
  batchMint: ClientSideBatchMint;
};

export type ClientSideBatchMintListWithStatus = {
  success: boolean;
  errorCode?: number;
  batchMints: ClientSideBatchMintListItem[];
  totalCount?: number;
  allTickers?: string[];
};

export class BatchMintTransformer {
  static transformBatchMintDataToClientSide(
    data: BatchMintEntity,
    walletAddress?: string,
    requiredKaspaAmount?: number,
  ): ClientSideBatchMint {
    return {
      id: data._id,
      ticker: data.ticker,
      totalMints: data.totalMints,
      finishedMints: data.finishedMints,
      maxPriorityFee: data.maxPriorityFee,
      status: data.status,
      transactions: data.transactions,
      transferTokenTransactions: data.transferTokenTransactions,
      refundTransactionId: data.refundTransactionId,
      batchMintWalletAddress: walletAddress,
      requiredKaspaAmount: requiredKaspaAmount,
      stopMintsAtMintsLeft: data.stopMintsAtMintsLeft,
      isReachedMintLimit: data.isReachedMintLimit,
      isUserCanceled: data.isUserCanceled,
    };
  }

  static transformBatchMintDataWithStatusToClientSide(data: BatchMintDataWithErrors): ClientSideBatchMintWithStatus {
    return {
      success: data.success,
      errorCode: data.errorCode,
      batchMint:
        data.batchMint && this.transformBatchMintDataToClientSide(data.batchMint, data.walletAddress, data.requiredKaspaAmount),
    };
  }

  static transformBatchMintListDataWithStatusToClientSide(data: BatchMintListDataWithErrors): ClientSideBatchMintListWithStatus {
    return {
      success: data.success,
      errorCode: data.errorCode,
      allTickers: data.allTickers,
      totalCount: data.totalCount,
      batchMints: data.batchMints
        ? data.batchMints.map((batchMint) => ({
            id: batchMint._id,
            ticker: batchMint.ticker,
            totalMints: batchMint.totalMints,
            finishedMints: batchMint.finishedMints,
            maxPriorityFee: batchMint.maxPriorityFee,
            status: batchMint.status,
            createdAt: batchMint.createdAt,
            stopMintsAtMintsLeft: batchMint.stopMintsAtMintsLeft,
            isReachedMintLimit: batchMint.isReachedMintLimit,
            isUserCanceled: batchMint.isUserCanceled,
          }))
        : [],
    };
  }
}
