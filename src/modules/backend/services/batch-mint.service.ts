import { Injectable } from '@nestjs/common';
import { BatchMintRepository } from '../repositories/batch-mint.repository';
import { UtilsHelper } from '../helpers/utils.helper';
import { BatchMintStatus } from '../model/enums/batch-mint-statuses.enum';

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
      maxPriorityFee,
      status: BatchMintStatus.CREATED,
      walletSequenceId,
    });
  }
}
