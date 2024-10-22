import { Injectable } from '@nestjs/common';
import { KaspaFacade } from '../facades/kaspa.facade';
import { PrivateKey } from 'libs/kaspa/kaspa';
import { CreateBatchMintRequestDto } from '../model/dtos/batch-mint/create-batch-mint-request.dto';
import { BatchMintService } from '../services/batch-mint.service';
import { BatchMintEntity } from '../model/schemas/batch-mint.schema';
import { TemporaryWalletSequenceService } from '../services/temporary-wallet-sequence.service';

@Injectable()
export class BatchMintProvider {
  constructor(
    private readonly batchMintService: BatchMintService,
    private readonly temporaryWalletService: TemporaryWalletSequenceService,
    private readonly kaspaFacade: KaspaFacade,
  ) {}
  async createBatchMint(ticker: string, ownerWalletAddress: string, batchMintRequestDto: CreateBatchMintRequestDto) {
    const walletSequenceId: number = await this.temporaryWalletService.getNextSequenceId();

    const batchMintEntity = await this.batchMintService.create(
      ticker,
      batchMintRequestDto.amount,
      ownerWalletAddress,
      walletSequenceId,
      batchMintRequestDto.maxPriorityFee,
    );

    return {
      success: true,
      batchMint: batchMintEntity,
    };
  }

  async doBatchMint(batchMintEntity: BatchMintEntity) {
    const batchMintWallet = await this.kaspaFacade.doBatchMint(batchMintEntity, async () => {});
  }
}
