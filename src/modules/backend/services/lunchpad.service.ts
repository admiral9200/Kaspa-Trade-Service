import { Injectable } from '@nestjs/common';
import { LunchpadRepository } from '../repositories/lunchpad.repository';
import { CreateLunchpadRequestDto } from '../model/dtos/lunchpad/create-lunchpad-request.dto';
import { LunchpadOrderStatus, LunchpadStatus } from '../model/enums/lunchpad-statuses.enum';
import { LunchpadEntity } from '../model/schemas/lunchpad.schema';
import { LunchpadOrder } from '../model/schemas/lunchpad-order.schema';
import { CreateLunchpadOrderRequestDto } from '../model/dtos/lunchpad/create-lunchpad-order-request.dto';
import { UtilsHelper } from '../helpers/utils.helper';
import { KRC20ActionTransations } from './kaspa-network/interfaces/Krc20ActionTransactions.interface';

@Injectable()
export class LunchpadService {
  constructor(
    private readonly lunchpadRepository: LunchpadRepository,
    private readonly utils: UtilsHelper,
  ) {}

  async getByTicker(ticker: string): Promise<LunchpadEntity> {
    return await this.lunchpadRepository.findOne({ ticker });
  }

  async getById(id: string): Promise<LunchpadEntity> {
    return await this.lunchpadRepository.findOne({ _id: id });
  }

  async createLunchpad(createLunchpadDto: CreateLunchpadRequestDto, ownerWallet: string, walletSequenceId: number) {
    return await this.lunchpadRepository.create({
      ticker: createLunchpadDto.ticker,
      kasPerUnit: createLunchpadDto.kasPerUnit,
      tokenPerUnit: createLunchpadDto.tokenPerUnit,
      maxFeeRatePerTransaction: createLunchpadDto.maxFeeRatePerTransaction,
      walletSequenceId,
      ownerWallet,
      status: LunchpadStatus.INACTIVE,
      minUnitsPerOrder: createLunchpadDto.minUnitsPerOrder,
      maxUnitsPerOrder: createLunchpadDto.maxUnitsPerOrder,
      availabeUnits: 0,
      totalUnits: 0,
      roundNumber: 0,
      currentTokensAmount: 0,
    });
  }

  async getByIdAndOwner(id: string, ownerWallet: string): Promise<LunchpadEntity> {
    return await this.lunchpadRepository.findOne({ _id: id, ownerWallet });
  }

  async startLunchpad(lunchpad: LunchpadEntity, totalTokens: number) {
    const totalUnits = Math.floor(totalTokens / lunchpad.tokenPerUnit);
    const result = await this.lunchpadRepository.updateLunchpadByStatus(
      lunchpad._id,
      {
        status: LunchpadStatus.ACTIVE,
        availabeUnits: totalUnits,
        totalUnits: totalUnits,
        roundNumber: lunchpad.roundNumber + 1,
        currentTokensAmount: totalTokens,
      },
      LunchpadStatus.INACTIVE,
    );

    return result;
  }

  async createLunchpadOrder(
    lunchpadId: string,
    data: CreateLunchpadOrderRequestDto,
    orderCreatorWallet: string,
  ): Promise<{ lunchpad: LunchpadEntity; lunchpadOrder: LunchpadOrder }> {
    const result = await this.utils.retryOnError(
      async () => await this.lunchpadRepository.createLunchpadOrderAndLockLunchpadQty(lunchpadId, data.units, orderCreatorWallet),
      10,
      1000,
      true,
      (error) => !this.lunchpadRepository.isDocumentTransactionLockedError(error),
    );

    return result;
  }

  async cancelLunchpadOrder(order: LunchpadOrder): Promise<{ lunchpad: LunchpadEntity; lunchpadOrder: LunchpadOrder }> {
    return await this.utils.retryOnError(
      async () => await this.lunchpadRepository.cancelLunchpadOrderAndLockLunchpadQty(order.lunchpadId, order._id),
      10,
      1000,
      true,
      (error) => !this.lunchpadRepository.isDocumentTransactionLockedError(error),
    );
  }

  async getOrderByIdAndWallet(orderId: string, walletAddress: string): Promise<LunchpadOrder> {
    return await this.lunchpadRepository.findOrderByIdAndWalletAddress(orderId, walletAddress);
  }

  async updateOrderUserTransactionId(orderId: string, transactionId: string): Promise<LunchpadOrder> {
    return await this.lunchpadRepository.updateOrderUserTransactionId(orderId, transactionId);
  }

  async setOrderStatusToVerifiedAndWaitingForProcessing(orderId: string, transactionId?: string): Promise<LunchpadOrder> {
    return await this.lunchpadRepository.transitionLunchpadOrderStatus(
      orderId,
      LunchpadOrderStatus.VERIFIED_AND_WAITING_FOR_PROCESSING,
      LunchpadOrderStatus.WAITING_FOR_KAS,
      transactionId ? { userTransactionId: transactionId } : null,
    );
  }

  async setOrderStatusToProcessing(orderId: string): Promise<LunchpadOrder> {
    return await this.lunchpadRepository.transitionLunchpadOrderStatus(
      orderId,
      LunchpadOrderStatus.PROCESSING,
      LunchpadOrderStatus.VERIFIED_AND_WAITING_FOR_PROCESSING,
    );
  }

  async setLowFeeErrorStatus(orderId: string): Promise<LunchpadOrder> {
    return await this.lunchpadRepository.transitionLunchpadOrderStatus(
      orderId,
      LunchpadOrderStatus.WAITING_FOR_LOW_FEE,
      LunchpadOrderStatus.PROCESSING,
    );
  }

  async setProcessingError(orderId: string, error: string): Promise<LunchpadOrder> {
    return await this.lunchpadRepository.transitionLunchpadOrderStatus(
      orderId,
      LunchpadOrderStatus.ERROR,
      LunchpadOrderStatus.PROCESSING,
      { error },
    );
  }

  isLunchpadInvalidStatusUpdateError(error) {
    return this.lunchpadRepository.isLunchpadInvalidStatusUpdateError(error);
  }

  async updateOrderTransactionsResult(orderId: string, result: Partial<KRC20ActionTransations>): Promise<LunchpadOrder> {
    return await this.lunchpadRepository.updateOrderTransactionsResult(orderId, result);
  }

  async reduceLunchpadTokenCurrentAmount(lunchpad: LunchpadEntity, amount: number): Promise<LunchpadEntity> {
    return await this.lunchpadRepository.reduceLunchpadTokenCurrentAmount(lunchpad._id, amount);
  }

  async setOrderCompleted(orderId: string): Promise<LunchpadOrder> {
    return await this.lunchpadRepository.transitionLunchpadOrderStatus(
      orderId,
      LunchpadOrderStatus.COMPLETED,
      LunchpadOrderStatus.PROCESSING,
    );
  }
}
