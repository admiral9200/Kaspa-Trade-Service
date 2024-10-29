import { BatchMintDataWithErrors } from '../model/dtos/batch-mint/batch-mint-data-with-wallet';
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
  transactions?: KRC20ActionTransations[];
  refundTransactionId?: string;
  batchMintWalletAddress?: string;
  requiredKaspaAmount?: number;
};

export type ClientSideBatchMintWithStatus = {
  success: boolean;
  errorCode?: number;
  batchMint: ClientSideBatchMint;
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
      refundTransactionId: data.refundTransactionId,
      batchMintWalletAddress: walletAddress,
      requiredKaspaAmount: requiredKaspaAmount,
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
}
