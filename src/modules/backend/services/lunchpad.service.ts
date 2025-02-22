import { Injectable } from '@nestjs/common';
import { LunchpadOrderWithLunchpad, LunchpadRepository } from '../repositories/lunchpad.repository';
import { CreateLunchpadRequestDto } from '../model/dtos/lunchpad/create-lunchpad-request.dto';
import { LunchpadOrderStatus, LunchpadStatus } from '../model/enums/lunchpad-statuses.enum';
import { LunchpadEntity } from '../model/schemas/lunchpad.schema';
import { LunchpadOrder } from '../model/schemas/lunchpad-order.schema';
import { CreateLunchpadOrderRequestDto } from '../model/dtos/lunchpad/create-lunchpad-order-request.dto';
import { UtilsHelper } from '../helpers/utils.helper';
import { KRC20ActionTransations } from './kaspa-network/interfaces/Krc20ActionTransactions.interface';
import { GetLunchpadListFiltersDto } from '../model/dtos/lunchpad/get-lunchpad-list';
import { SortDto } from '../model/dtos/abstract/sort.dto';
import { PaginationDto } from '../model/dtos/abstract/pagination.dto';
import { UpdateLunchpadRequestDto } from '../model/dtos/lunchpad/update-lunchpad-request.dto';
import { GetLunchpadOrderListDto } from '../model/dtos/lunchpad/get-lunchpad-order-list';

export const ALLOWED_UPDATE_STATUSES_FOR_LUNCHPAD = [LunchpadStatus.SOLD_OUT, LunchpadStatus.INACTIVE];
export const NEEDED_TO_PROCESS_STATUSES_FOR_LUNCHPAD_ORDER = [
  LunchpadOrderStatus.VERIFIED_AND_WAITING_FOR_PROCESSING,
  LunchpadOrderStatus.PROCESSING,
];
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

  async createLunchpad(
    createLunchpadDto: CreateLunchpadRequestDto,
    ownerWallet: string,
    senderWalletSequenceId: number,
    receiverWalletSequenceId: number,
  ): Promise<LunchpadEntity> {
    return await this.lunchpadRepository.create({
      ticker: createLunchpadDto.ticker,
      kasPerUnit: createLunchpadDto.kasPerUnit,
      tokenPerUnit: createLunchpadDto.tokenPerUnit,
      maxFeeRatePerTransaction: createLunchpadDto.maxFeeRatePerTransaction,
      senderWalletSequenceId,
      receiverWalletSequenceId,
      ownerWallet,
      status: LunchpadStatus.INACTIVE,
      minUnitsPerOrder: createLunchpadDto.minUnitsPerOrder || 1,
      maxUnitsPerOrder: createLunchpadDto.maxUnitsPerOrder || 10,
      availabeUnits: 0,
      totalUnits: 0,
      roundNumber: 0,
      currentTokensAmount: 0,
      isRunning: false,
      rounds: [],
      useWhitelist: createLunchpadDto.useWhitelist || false,
      maxUnitsPerWallet: createLunchpadDto.maxUnitsPerWallet || 10000,
      whitelistWalletAddresses: createLunchpadDto.whitelistWalletAddresses || [],
    });
  }

  async updateLunchpad(id: string, updateLunchpadDto: UpdateLunchpadRequestDto, ownerWallet: string): Promise<LunchpadEntity> {
    return await this.lunchpadRepository.updateLunchpadByOwnerAndStatus(
      id,
      updateLunchpadDto,
      ALLOWED_UPDATE_STATUSES_FOR_LUNCHPAD,
      ownerWallet,
    );
  }

  async getByIdAndOwner(id: string, ownerWallet: string): Promise<LunchpadEntity> {
    return await this.lunchpadRepository.findOne({ _id: id, ownerWallet });
  }

  calculateLunchpadUnits(totalTokens: number, tokenPerUnit: number) {
    return Math.floor(totalTokens / tokenPerUnit);
  }

  async startLunchpad(lunchpad: LunchpadEntity, totalTokens: number) {
    const totalUnits = this.calculateLunchpadUnits(totalTokens, lunchpad.tokenPerUnit);

    const lunchpadRounds = lunchpad.rounds;
    const currentRound = lunchpad.roundNumber + 1;

    lunchpadRounds.push({
      roundNumber: currentRound,
      kasPerUnit: lunchpad.kasPerUnit,
      tokenPerUnit: lunchpad.tokenPerUnit,
      maxFeeRatePerTransaction: lunchpad.maxFeeRatePerTransaction,
      tokensAmount: totalTokens,
      totalUnits,
    });

    const result = await this.lunchpadRepository.updateLunchpadByStatus(
      lunchpad._id,
      {
        status: LunchpadStatus.ACTIVE,
        availabeUnits: totalUnits,
        totalUnits: totalUnits,
        roundNumber: currentRound,
        currentTokensAmount: totalTokens,
        rounds: lunchpadRounds,
      },
      LunchpadStatus.INACTIVE,
    );

    return result;
  }

  async stopLunchpad(lunchpad: LunchpadEntity) {
    const updatedLunchpad = await this.lunchpadRepository.updateLunchpadByStatus(
      lunchpad._id,
      { status: LunchpadStatus.STOPPING },
      lunchpad.status === LunchpadStatus.SOLD_OUT ? LunchpadStatus.SOLD_OUT : LunchpadStatus.ACTIVE,
    );

    return await this.setLunchpadInactiveIfNoOrdersAndNotRunning(updatedLunchpad);
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
    const result = await this.utils.retryOnError(
      async () => await this.lunchpadRepository.cancelLunchpadOrderAndLockLunchpadQty(order.lunchpadId, order._id),
      10,
      1000,
      true,
      (error) => !this.lunchpadRepository.isDocumentTransactionLockedError(error),
    );

    if (result.lunchpad.status == LunchpadStatus.STOPPING) {
      result.lunchpad = await this.setLunchpadInactiveIfNoOrdersAndNotRunning(result.lunchpad);
    }

    return result;
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

  async setOrderStatusToProcessing(orderId: string, isProcessing: boolean = false): Promise<LunchpadOrder> {
    return await this.lunchpadRepository.transitionLunchpadOrderStatus(
      orderId,
      LunchpadOrderStatus.PROCESSING,
      isProcessing ? LunchpadOrderStatus.PROCESSING : LunchpadOrderStatus.VERIFIED_AND_WAITING_FOR_PROCESSING, // like this to do verification
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

  async checkIfLunchpadNeedsStatusChangeAfterOrderCompleted(lunchpad: LunchpadEntity) {
    if (lunchpad.availabeUnits < lunchpad.minUnitsPerOrder) {
      const roundsData = lunchpad.rounds;

      const currentRound = lunchpad.rounds[lunchpad.roundNumber - 1];

      if (!currentRound || currentRound.roundNumber != lunchpad.roundNumber) {
        throw new Error('Lunchpad round number mismatch');
      }

      currentRound.unitsLeft = lunchpad.availabeUnits;

      if (lunchpad.status == LunchpadStatus.NO_UNITS_LEFT) {
        lunchpad = await this.lunchpadRepository.updateLunchpadByStatus(
          lunchpad._id,
          { status: LunchpadStatus.SOLD_OUT, rounds: roundsData },
          LunchpadStatus.NO_UNITS_LEFT,
        );
      } else if (lunchpad.status == LunchpadStatus.STOPPING) {
        lunchpad = await this.setLunchpadInactiveIfNoOrdersAndNotRunning(lunchpad);
      }
    }

    return lunchpad;
  }

  async setOrderCompleted(orderId: string): Promise<LunchpadOrder> {
    return await this.lunchpadRepository.transitionLunchpadOrderStatus(
      orderId,
      LunchpadOrderStatus.COMPLETED,
      LunchpadOrderStatus.PROCESSING,
    );
  }

  async startRunningLunchpad(lunchpad: LunchpadEntity) {
    return await this.lunchpadRepository.setLunchpadIsRunning(lunchpad._id, true, lunchpad.status);
  }

  async stopRunningLunchpad(lunchpadId: string) {
    const lunchpad = await this.lunchpadRepository.setLunchpadIsRunning(lunchpadId, false);

    return await this.setLunchpadInactiveIfNoOrdersAndNotRunning(lunchpad);
  }

  async setLunchpadInactiveIfNoOrdersAndNotRunning(lunchpad: LunchpadEntity): Promise<LunchpadEntity> {
    if (lunchpad.status == LunchpadStatus.STOPPING) {
      const waitingOrders = await this.getLunchpadOpenOrders(lunchpad);

      if (waitingOrders.length == 0) {
        const roundsData = lunchpad.rounds;

        const currentRound = lunchpad.rounds[lunchpad.roundNumber - 1];

        if (!currentRound || currentRound.roundNumber != lunchpad.roundNumber) {
          throw new Error('Lunchpad round number mismatch');
        }

        currentRound.unitsLeft = lunchpad.availabeUnits;

        return await this.lunchpadRepository.stopLunchpadIfNotRunning(lunchpad._id, roundsData);
      }
    }

    return lunchpad;
  }

  async getLunchpadOpenOrders(lunchpad: LunchpadEntity): Promise<LunchpadOrder[]> {
    return await this.lunchpadRepository.getOrdersByRoundAndStatuses(lunchpad._id, lunchpad.roundNumber, [
      LunchpadOrderStatus.WAITING_FOR_KAS,
      LunchpadOrderStatus.VERIFIED_AND_WAITING_FOR_PROCESSING,
      LunchpadOrderStatus.PROCESSING,
      LunchpadOrderStatus.ERROR,
    ]);
  }

  async getReadyToProcessOrders(lunchpad: LunchpadEntity) {
    return await this.lunchpadRepository.getOrdersByRoundAndStatuses(
      lunchpad._id,
      lunchpad.roundNumber,
      NEEDED_TO_PROCESS_STATUSES_FOR_LUNCHPAD_ORDER,
      { createdAt: 1 },
    );
  }

  async setWalletKeyExposedBy(batchMint: LunchpadEntity, viewerWallet: string, walletType: string) {
    await this.lunchpadRepository.setWalletKeyExposedBy(batchMint, viewerWallet, walletType);
  }

  async getLunchpadList(
    filters: GetLunchpadListFiltersDto,
    sort: SortDto,
    pagination: PaginationDto,
    walletAddress?: string,
  ): Promise<{ lunchpads: LunchpadEntity[]; totalCount: number }> {
    if (filters.ownerOnly && !walletAddress) {
      return { lunchpads: [], totalCount: 0 };
    }

    return await this.lunchpadRepository.getLunchpadList(filters, sort, pagination, walletAddress);
  }

  async getOrdersUsedTransactionsForLunchpad(lunchpadId: string) {
    return await this.lunchpadRepository.getOrdersUsedTransactionsForLunchpad(lunchpadId);
  }

  async getLunchpadIdsWithWaitingForKasTooLongOrders(): Promise<string[]> {
    return await this.lunchpadRepository.getLunchpadIdsWithWaitingForKasTooLongOrders();
  }
  async getLunchpadWaitingForKasOrders(lunchpad: LunchpadEntity): Promise<LunchpadOrder[]> {
    return await this.lunchpadRepository.getLunchpadWaitingForKasOrders(lunchpad._id);
  }

  async getLunchpadOrders(
    lunchpadId: string,
    getLaunchpadOrderListDto: GetLunchpadOrderListDto,
  ): Promise<{ orders: LunchpadOrder[]; totalCount: number }> {
    return await this.lunchpadRepository.getLunchpadOrders(
      lunchpadId,
      getLaunchpadOrderListDto.filters,
      getLaunchpadOrderListDto.sort,
      getLaunchpadOrderListDto.pagination,
    );
  }

  getLunchpadOrderUnits(lunchpad: LunchpadEntity, order: LunchpadOrder): { tokenPerUnit: number; kasPerUnit: number } {
    const roundData = lunchpad.rounds.filter((r) => r.roundNumber == order.roundNumber)[0];

    if (!roundData) {
      throw new Error('Round data not found');
    }

    return { tokenPerUnit: roundData.tokenPerUnit, kasPerUnit: roundData.kasPerUnit };
  }

  async getLunchpadsWithOpenOrders(): Promise<LunchpadEntity[]> {
    return await this.lunchpadRepository.getLunchpadsForOrdersWithStatus(NEEDED_TO_PROCESS_STATUSES_FOR_LUNCHPAD_ORDER);
  }

  async getLunchpadOrdersForWallet(
    getLaunchpadOrderListDto: GetLunchpadOrderListDto,
    walletAddress: string,
  ): Promise<{
    orders: LunchpadOrderWithLunchpad[];
    tickers: string[];
    totalCount: number;
  }> {
    return await this.lunchpadRepository.getLunchpadOrdersForWallet(
      walletAddress,
      getLaunchpadOrderListDto.filters,
      getLaunchpadOrderListDto.sort,
      getLaunchpadOrderListDto.pagination,
    );
  }
}
