import { Injectable } from '@nestjs/common';
import { KaspaFacade } from '../facades/kaspa.facade';
import { CreateBatchMintRequestDto } from '../model/dtos/batch-mint/create-batch-mint-request.dto';
import { BatchMintService } from '../services/batch-mint.service';
import { TemporaryWalletSequenceService } from '../services/temporary-wallet-sequence.service';
import { KRC20ActionTransations } from '../services/kaspa-network/interfaces/Krc20ActionTransactions.interface';
import { AppLogger } from 'src/modules/core/modules/logger/app-logger.abstract';
import { TelegramBotService } from 'src/modules/shared/telegram-notifier/services/telegram-bot.service';
import { BatchMintDataWithErrors, BatchMintListDataWithErrors } from '../model/dtos/batch-mint/batch-mint-data-with-wallet';
import { BatchMintStatus } from '../model/enums/batch-mint-statuses.enum';
import { BatchMintEntity } from '../model/schemas/batch-mint.schema';
import { ERROR_CODES } from '../constants';
import { PodJobProvider } from './pod-job-provider';
import { PodNotInitializedError } from '../services/kaspa-network/errors/PodNotInitializedError';

@Injectable()
export class BatchMintProvider {
  constructor(
    private readonly batchMintService: BatchMintService,
    private readonly temporaryWalletService: TemporaryWalletSequenceService,
    private readonly kaspaFacade: KaspaFacade,
    private readonly logger: AppLogger,
    private readonly telegramBotService: TelegramBotService,
    private readonly podJobProvider: PodJobProvider,
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
      batchMintRequestDto.stopMintsAtMintsLeft,
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

  async validateAndStartBatchMintPod(id: string, ownerWalletAddress: string): Promise<BatchMintDataWithErrors> {
    const batchMintEntity = await this.batchMintService.getByIdAndWallet(id, ownerWalletAddress);

    if (!batchMintEntity) {
      return {
        success: false,
        errorCode: ERROR_CODES.GENERAL.NOT_FOUND,
      };
    }

    if (batchMintEntity.status != BatchMintStatus.CREATED_AND_WAITING_FOR_KAS) {
      return {
        success: false,
        errorCode: ERROR_CODES.BATCH_MINT.INVALID_BATCH_MINT_STATUS,
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
        errorCode: ERROR_CODES.BATCH_MINT.INVALID_KASPA_AMOUNT,
      };
    }

    try {
      await this.batchMintService.updateStatusToWaitingForJob(batchMintEntity._id);
    } catch {
      return {
        success: false,
        errorCode: ERROR_CODES.BATCH_MINT.INVALID_BATCH_MINT_STATUS,
      };
    }

    try {
      await this.podJobProvider.startBatchMintingJob(batchMintEntity._id);
    } catch (error) {
      this.logger.error(error?.message || error, error?.stack, error?.meta);
      this.telegramBotService.sendErrorToErrorsChannel(new PodNotInitializedError(error, batchMintEntity));

      try {
        await this.batchMintService.updateStatusToPodNotInitializedError(batchMintEntity._id, error.toString());
      } catch {
        this.logger.error(error?.message || error, error?.stack, error?.meta);
      }

      return {
        success: false,
        errorCode: ERROR_CODES.GENERAL.UNKNOWN_ERROR,
      };
    }

    return {
      success: true,
      batchMint: batchMintEntity,
    };
  }

  // This is what the pod should run
  async startBatchMintJob(id: string): Promise<void> {
    const batchMintEntity = await this.batchMintService.getById(id);

    if (!batchMintEntity) {
      throw new Error('Batch mint not found');
    }

    if (batchMintEntity.status != BatchMintStatus.ERROR) {
      let isValidated = false;

      try {
        isValidated = await this.kaspaFacade.validateBatchMintWalletAmount(batchMintEntity);
      } catch (error) {
        this.logger.error(error?.message || error, error?.stack, error?.meta);
        this.telegramBotService.sendErrorToErrorsChannel(error);
        throw error;
      }

      if (!isValidated) {
        throw new Error('Invalid batch mint wallet amount');
      }
    }

    let updatedBatchMint = batchMintEntity;

    try {
      updatedBatchMint = await this.batchMintService.updateStatusToInProgress(
        batchMintEntity._id,
        batchMintEntity.status == BatchMintStatus.ERROR,
      );
    } catch (error) {
      const isStatusError = this.batchMintService.isBatchMintInvalidStatusUpdateError(error);

      if (!isStatusError) {
        this.logger.error(error?.message || error, error?.stack, error?.meta);
      }

      throw error;
    }

    try {
      const result = await this.kaspaFacade.doBatchMint(
        batchMintEntity,
        async (transactions: KRC20ActionTransations) => {
          updatedBatchMint = await this.batchMintService.updateMintProgress(updatedBatchMint, transactions);
        },
        async (transactions: KRC20ActionTransations) => {
          updatedBatchMint = await this.batchMintService.updateTransferTokenTransactions(updatedBatchMint, transactions);
        },
        (): BatchMintEntity => {
          return updatedBatchMint;
        },
      );

      updatedBatchMint = await this.batchMintService.updateStatusToCompleted(
        updatedBatchMint._id,
        result.refundTransactionId,
        result.isMintOver,
      );
    } catch (error) {
      await this.batchMintService.updateStatusToError(updatedBatchMint._id, error.toString());
      this.logger.error(error?.message || error, error?.stack, error?.meta);
      this.telegramBotService.sendErrorToErrorsChannel(error);

      throw error;
    }
  }

  async getBatchMintsByWallet(walletAddress: string): Promise<BatchMintListDataWithErrors> {
    const batchMints = await this.batchMintService.getByWallet(walletAddress);

    console.log('batchMints', batchMints);

    return {
      success: true,
      batchMints,
    };
  }
}
