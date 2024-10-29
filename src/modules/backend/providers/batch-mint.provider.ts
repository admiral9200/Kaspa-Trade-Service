import { Injectable } from '@nestjs/common';
import { KaspaFacade } from '../facades/kaspa.facade';
import { CreateBatchMintRequestDto } from '../model/dtos/batch-mint/create-batch-mint-request.dto';
import { BatchMintService } from '../services/batch-mint.service';
import { TemporaryWalletSequenceService } from '../services/temporary-wallet-sequence.service';
import { KRC20ActionTransations } from '../services/kaspa-network/interfaces/Krc20ActionTransactions.interface';
import { AppLogger } from 'src/modules/core/modules/logger/app-logger.abstract';
import { TelegramBotService } from 'src/modules/shared/telegram-notifier/services/telegram-bot.service';
import { BatchMintDataWithErrors } from '../model/dtos/batch-mint/batch-mint-data-with-wallet';
import { ERROR_CODES } from '../constants';

@Injectable()
export class BatchMintProvider {
  constructor(
    private readonly batchMintService: BatchMintService,
    private readonly temporaryWalletService: TemporaryWalletSequenceService,
    private readonly kaspaFacade: KaspaFacade,
    private readonly logger: AppLogger,
    private readonly telegramBotService: TelegramBotService,
  ) {}
  async createBatchMint(
    ticker: string,
    ownerWalletAddress: string,
    batchMintRequestDto: CreateBatchMintRequestDto,
  ): Promise<BatchMintDataWithErrors> {
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
      requiredKaspaAmount: this.kaspaFacade.getRequiredAmountForBatchMint(
        batchMintEntity.totalMints,
        batchMintEntity.maxPriorityFee,
      ),
      walletAddress: await this.kaspaFacade.getAccountWalletAddressAtIndex(walletSequenceId),
    };
  }

  async getBatchMintRequiredKaspa(batchMintRequestDto: CreateBatchMintRequestDto): Promise<BatchMintDataWithErrors> {
    return {
      success: true,
      requiredKaspaAmount: this.kaspaFacade.getRequiredAmountForBatchMint(
        batchMintRequestDto.amount,
        batchMintRequestDto.maxPriorityFee,
      ),
    };
  }

  async checkIfWalletHasValidKaspaAmount(id: string, ownerWalletAddress: string): Promise<boolean> {
    const batchMintEntity = await this.batchMintService.getByIdAndWallet(id, ownerWalletAddress);

    if (!batchMintEntity) {
      return false;
    }

    return await this.validateBatchMintWalletAmount(batchMintEntity);
  }

  async validateBatchMintWalletAmount(batchMintEntity: any): Promise<boolean> {
    try {
      return await this.kaspaFacade.validateBatchMintWalletAmount(batchMintEntity);
    } catch (error) {
      return false;
    }
  }

  async doBatchMint(id: string, ownerWalletAddress: string): Promise<BatchMintDataWithErrors> {
    const batchMintEntity = await this.batchMintService.getByIdAndWallet(id, ownerWalletAddress);

    if (!batchMintEntity) {
      return {
        success: false,
        batchMint: null,
        errorCode: ERROR_CODES.GENERAL.NOT_FOUND,
      };
    }

    let isValidated = false;

    try {
      isValidated = await this.kaspaFacade.validateBatchMintWalletAmount(batchMintEntity);
    } catch (error) {
      this.logger.error(error?.message || error, error?.stack, error?.meta);
      this.telegramBotService.sendErrorToErrorsChannel(error);
    }

    if (!isValidated) {
      return {
        success: false,
        batchMint: null,
        errorCode: ERROR_CODES.BATCH_MINT.INVALID_KASPA_AMOUNT,
      };
    }

    let updatedBatchMint = await this.batchMintService.updateStatusToInProgress(batchMintEntity._id);

    try {
      const result = await this.kaspaFacade.doBatchMint(batchMintEntity, async (transactions: KRC20ActionTransations) => {
        updatedBatchMint = await this.batchMintService.updateMintProgress(updatedBatchMint, transactions);
      });

      updatedBatchMint = await this.batchMintService.updateStatusToCompleted(
        updatedBatchMint._id,
        result.refundTransactionId,
        result.isMintOver,
      );

      return {
        success: true,
        batchMint: updatedBatchMint,
      };
    } catch (error) {
      await this.batchMintService.updateStatusToError(updatedBatchMint._id, error.toString());
      this.logger.error(error?.message || error, error?.stack, error?.meta);
      this.telegramBotService.sendErrorToErrorsChannel(error);

      return {
        success: false,
        batchMint: updatedBatchMint,
        errorCode: ERROR_CODES.GENERAL.UNKNOWN_ERROR,
      };
    }
  }
}
