import { BatchMintEntity } from '../../schemas/batch-mint.schema';

export interface BatchMintDataWithErrors {
  success: boolean;
  errorCode?: number;
  batchMint?: BatchMintEntity;
  walletAddress?: string;
  requiredKaspaAmount?: number;
}

export interface BatchMintListDataWithErrors {
  success: boolean;
  errorCode?: number;
  batchMints?: BatchMintEntity[];
}
