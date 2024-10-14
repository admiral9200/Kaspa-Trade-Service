import { Injectable } from '@nestjs/common';
import { LunchpadRepository } from '../repositories/lunchpad.repository';
import { CreateLunchpadRequestDto } from '../model/dtos/lunchpad/create-lunchpad-request.dto';
import { LunchpadStatus } from '../model/enums/lunchpad-statuses.enum';
import { LunchpadEntity } from '../model/schemas/lunchpad.schema';
import { LunchpadOrder } from '../model/schemas/lunchpad-order.schema';
import { CreateLunchpadOrderRequestDto } from '../model/dtos/lunchpad/create-lunchpad-order-request.dto';
import { UtilsHelper } from '../helpers/utils.helper';

@Injectable()
export class LunchpadService {
  constructor(
    private readonly lunchpadRepository: LunchpadRepository,
    private readonly utils: UtilsHelper,
  ) {}

  async getByTicker(ticker: string): Promise<LunchpadEntity> {
    return await this.lunchpadRepository.findOne({ ticker });
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
      minimumUnitsPerOrder: createLunchpadDto.minimumUnitsPerOrder,
      availabeUnits: 0,
    });
  }

  async getByIdAndOwner(id: string, ownerWallet: string): Promise<LunchpadEntity> {
    return await this.lunchpadRepository.findOne({ _id: id, ownerWallet });
  }

  async startLunchpad(lunchpad: any, totalTokens: number) {
    const result = await this.lunchpadRepository.updateLunchpadByStatus(
      lunchpad._id,
      {
        status: LunchpadStatus.ACTIVE,
        availabeUnits: Math.floor(totalTokens / lunchpad.tokenPerUnit),
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
    return await this.utils.retryOnError(
      async () => await this.lunchpadRepository.createLunchpadOrderAndLockLunchpadQty(lunchpadId, data.units, orderCreatorWallet),
      10,
      1000,
      true,
      (error) => !this.lunchpadRepository.isDocumentTransactionLockedError(error),
    );
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
    return this.lunchpadRepository.findOrderByIdAndWalletAddress(orderId, walletAddress);
  }
}
