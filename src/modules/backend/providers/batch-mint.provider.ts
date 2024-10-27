import { Injectable } from '@nestjs/common';
import { KaspaFacade } from '../facades/kaspa.facade';
import { CreateBatchMintRequestDto } from '../model/dtos/batch-mint/create-batch-mint-request.dto';
import { BatchMintService } from '../services/batch-mint.service';
import { TemporaryWalletSequenceService } from '../services/temporary-wallet-sequence.service';
import { KRC20ActionTransations } from '../services/kaspa-network/interfaces/Krc20ActionTransactions.interface';
import { AppLogger } from 'src/modules/core/modules/logger/app-logger.abstract';
import { TelegramBotService } from 'src/modules/shared/telegram-notifier/services/telegram-bot.service';

@Injectable()
export class BatchMintProvider {
  constructor(
    private readonly batchMintService: BatchMintService,
    private readonly temporaryWalletService: TemporaryWalletSequenceService,
    private readonly kaspaFacade: KaspaFacade,
    private readonly logger: AppLogger,
    private readonly telegramBotService: TelegramBotService,
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

  async doBatchMint(id: string, ownerWalletAddress: string) {
    const batchMintEntity = await this.batchMintService.getByIdAndWallet(id, ownerWalletAddress);

    if (!batchMintEntity) {
      throw new Error('Batch mint not found');
    }

    const isValidated = await this.kaspaFacade.validateBatchMintWalletAmount(batchMintEntity);

    if (!isValidated) {
      throw new Error('Invalid wallet amount');
    }

    let updatedBatchMint = await this.batchMintService.updateStatusToInProgress(batchMintEntity._id);

    try {
      const result = await this.kaspaFacade.doBatchMint(batchMintEntity, async (transactions: KRC20ActionTransations) => {
        updatedBatchMint = await this.batchMintService.updateMintProgress(updatedBatchMint, transactions);
      });

      await this.batchMintService.updateStatusToCompleted(updatedBatchMint._id, result.refundTransactionId, result.isMintOver);
    } catch (error) {
      await this.batchMintService.updateStatusToError(updatedBatchMint._id, error.toString());
      this.logger.error(error?.message || error, error?.stack, error?.meta);
      this.telegramBotService.sendErrorToErrorsChannel(error);
      throw error;
    }
  }
}
