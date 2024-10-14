import { Injectable } from '@nestjs/common';
import { KaspaFacade } from '../facades/kaspa.facade';
import { TemporaryWalletSequenceService } from '../services/temporary-wallet-sequence.service';
import { KaspaNetworkActionsService } from '../services/kaspa-network/kaspa-network-actions.service';
import { AppLogger } from 'src/modules/core/modules/logger/app-logger.abstract';
import { LunchpadService } from '../services/lunchpad.service';
import { CreateLunchpadRequestDto } from '../model/dtos/lunchpad/create-lunchpad-request.dto';
import { LunchpadStatus } from '../model/enums/lunchpad-statuses.enum';
import { LunchpadDataWithWallet, LunchpadOrderDataWithErrors } from '../model/dtos/lunchpad/lunchpad-data-with-wallet';
import { ERROR_CODES } from '../constants';
import { CreateLunchpadOrderRequestDto } from '../model/dtos/lunchpad/create-lunchpad-order-request.dto';
import { LunchpadNotEnoughAvailableQtyError } from '../services/kaspa-network/errors/LunchpadNotEnoughAvailableQtyError';

@Injectable()
export class LunchpadProvider {
  constructor(
    private readonly lunchpadService: LunchpadService,
    private readonly kaspaFacade: KaspaFacade,
    private readonly temporaryWalletService: TemporaryWalletSequenceService,
    private readonly kaspaNetworkActionsService: KaspaNetworkActionsService,
    private readonly logger: AppLogger,
  ) {}

  async getLunchpadByTicker(ticker: string): Promise<LunchpadDataWithWallet> {
    const lunchpad = await this.lunchpadService.getByTicker(ticker);

    if (!lunchpad) {
      return {
        success: false,
        errorCode: ERROR_CODES.GENERAL.NOT_FOUND,
        lunchpad: null,
        walletAddress: null,
      };
    }

    const walletAddress = await this.kaspaFacade.getAccountWalletAddressAtIndex(lunchpad.walletSequenceId);

    return {
      success: true,
      lunchpad,
      walletAddress,
    };
  }

  async createLunchpad(createLunchpadDto: CreateLunchpadRequestDto, ownerWalletAddress: string): Promise<LunchpadDataWithWallet> {
    const walletSequenceId: number = await this.temporaryWalletService.getNextSequenceId();

    const lunchpad = await this.lunchpadService.createLunchpad(createLunchpadDto, ownerWalletAddress, walletSequenceId);

    if (!lunchpad) {
      console.error('Failed to create lunchpad', createLunchpadDto, lunchpad);
      return {
        success: false,
        errorCode: ERROR_CODES.GENERAL.UNKNOWN_ERROR,
        lunchpad: null,
        walletAddress: null,
      };
    }

    const walletAddress = await this.kaspaFacade.getAccountWalletAddressAtIndex(lunchpad.walletSequenceId);

    return {
      success: true,
      lunchpad,
      walletAddress,
    };
  }

  async startLunchpad(id: string, ownerWalletAddress: string): Promise<LunchpadDataWithWallet> {
    const lunchpad = await this.lunchpadService.getByIdAndOwner(id, ownerWalletAddress);

    if (!lunchpad) {
      return {
        success: false,
        errorCode: ERROR_CODES.GENERAL.NOT_FOUND,
        lunchpad: null,
        walletAddress: null,
      };
    }

    if (lunchpad.status == LunchpadStatus.ACTIVE) {
      return {
        success: false,
        errorCode: ERROR_CODES.LUNCHPAD.INVALID_LUNCHPAD_STATUS,
        lunchpad: lunchpad,
        walletAddress: null,
      };
    }

    const walletAddress = await this.kaspaFacade.getAccountWalletAddressAtIndex(lunchpad.walletSequenceId);

    const krc20TokenAmountBigint = await this.kaspaFacade.getKrc20TokenBalance(walletAddress, lunchpad.ticker);

    const krc20TokenAmount = KaspaNetworkActionsService.SompiToNumber(krc20TokenAmountBigint);

    if (!krc20TokenAmount || krc20TokenAmount < lunchpad.tokenPerUnit) {
      return {
        success: false,
        walletAddress,
        lunchpad,
        krc20TokensAmount: krc20TokenAmount,
        errorCode: ERROR_CODES.LUNCHPAD.NOT_ENOUGH_KRC20_TOKENS,
      };
    }

    const updatedLunchpad = await this.lunchpadService.startLunchpad(lunchpad, krc20TokenAmount);

    return {
      success: true,
      lunchpad: updatedLunchpad,
      krc20TokensAmount: krc20TokenAmount,
      walletAddress,
    };
  }

  async createLunchpadOrder(
    ticker: string,
    body: CreateLunchpadOrderRequestDto,
    orderCreatorWallet: string,
  ): Promise<LunchpadOrderDataWithErrors> {
    const lunchpad = await this.lunchpadService.getByTicker(ticker);

    if (!lunchpad) {
      return {
        success: false,
        errorCode: ERROR_CODES.GENERAL.NOT_FOUND,
        lunchpadOrder: null,
      };
    }

    if (lunchpad.status != LunchpadStatus.ACTIVE) {
      return {
        success: false,
        errorCode: ERROR_CODES.LUNCHPAD.INVALID_LUNCHPAD_STATUS,
        lunchpadOrder: null,
        lunchpad: lunchpad,
      };
    }

    if (body.units < lunchpad.minimumUnitsPerOrder) {
      return {
        success: false,
        errorCode: ERROR_CODES.LUNCHPAD.INVALID_ORDER_UNITS,
        lunchpadOrder: null,
        lunchpad: lunchpad,
      };
    }

    try {
      const result = await this.lunchpadService.createLunchpadOrder(lunchpad._id, body, orderCreatorWallet);

      return {
        success: true,
        lunchpad: result.lunchpad,
        lunchpadOrder: result.lunchpadOrder,
      };
    } catch (error) {
      if (!(error instanceof LunchpadNotEnoughAvailableQtyError)) {
        this.logger.error('Failed to create lunchpad order');
        this.logger.error(error, error?.stack, error?.meta);
      }

      return {
        success: false,
        errorCode:
          error instanceof LunchpadNotEnoughAvailableQtyError
            ? ERROR_CODES.LUNCHPAD.LUNCHPAD_UNITS_EXCEEDS
            : ERROR_CODES.GENERAL.UNKNOWN_ERROR,
        lunchpadOrder: null,
        lunchpad: lunchpad,
      };
    }
  }

  async processOrder(orderId, walletAddress): Promise<LunchpadOrderDataWithErrors> {
    return null;
  }
}
