import { Injectable } from '@nestjs/common';
import { KaspaFacade } from '../facades/kaspa.facade';
import { PrivateKey } from 'libs/kaspa/kaspa';
import { CreateBatchMintRequestDto } from '../model/dtos/batch-mint/create-batch-mint-request.dto';

@Injectable()
export class BatchMintProvider {
  constructor(private readonly kaspaFacade: KaspaFacade) {}
  async createBatchMint(ticker: string, ownerWalletAddress: string, batchMintRequestDto: CreateBatchMintRequestDto) {
    await this.kaspaFacade.doBatchMint(
      new PrivateKey('89ccb3e6969aa3bb48568de3172fd5ae31942ca8cb3aace665931b11cb033cc8'),
      ticker,
      batchMintRequestDto.amount,
      batchMintRequestDto.maxPriorityFee,
    );
  }
}
