import { Injectable } from '@nestjs/common';
import { KaspaFacade } from '../facades/kaspa.facade';
import { TemporaryWalletSequenceService } from '../services/temporary-wallet-sequence.service';
import { KaspaNetworkActionsService } from '../services/kaspa-network/kaspa-network-actions.service';
import { AppLogger } from 'src/modules/core/modules/logger/app-logger.abstract';
import { LunchpadService } from '../services/lunchpad.service';
import { CreateLunchpadRequestDto } from '../model/dtos/lunchpad/create-lunchpad-request.dto';
import { LunchpadOrderStatus, LunchpadStatus } from '../model/enums/lunchpad-statuses.enum';
import { LunchpadDataWithWallet, LunchpadOrderDataWithErrors } from '../model/dtos/lunchpad/lunchpad-data-with-wallet';
import { ERROR_CODES } from '../constants';
import { CreateLunchpadOrderRequestDto } from '../model/dtos/lunchpad/create-lunchpad-order-request.dto';
import { LunchpadNotEnoughAvailableQtyError } from '../services/kaspa-network/errors/LunchpadNotEnoughAvailableQtyError';
import { KaspaApiService } from '../services/kaspa-api/services/kaspa-api.service';
import { PriorityFeeTooHighError } from '../services/kaspa-network/errors/PriorityFeeTooHighError';
import { TelegramBotService } from 'src/modules/shared/telegram-notifier/services/telegram-bot.service';
import { LunchpadOrder } from '../model/schemas/lunchpad-order.schema';
import { LunchpadEntity } from '../model/schemas/lunchpad.schema';

@Injectable()
export class LunchpadProvider {
  constructor(
    private readonly lunchpadService: LunchpadService,
    private readonly kaspaFacade: KaspaFacade,
    private readonly temporaryWalletService: TemporaryWalletSequenceService,
    private readonly kaspaApiService: KaspaApiService,
    private readonly telegramBotService: TelegramBotService,
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

    if (lunchpad.minUnitsPerOrder && body.units < lunchpad.minUnitsPerOrder) {
      return {
        success: false,
        errorCode: ERROR_CODES.LUNCHPAD.INVALID_ORDER_UNITS,
        lunchpadOrder: null,
        lunchpad: lunchpad,
      };
    }

    if (lunchpad.maxUnitsPerOrder && body.units > lunchpad.maxUnitsPerOrder) {
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

  async processOrder(orderId, userWalletAddress, transactionId): Promise<LunchpadOrderDataWithErrors> {
    const orderData = await this.getOrderByIdAndWalletAndStatus(
      orderId,
      userWalletAddress,
      LunchpadOrderStatus.WAITING_FOR_KAS,
      true,
    );

    if (!orderData.success) {
      return orderData;
    }

    if (!orderData.lunchpad || !orderData.lunchpadOrder) {
      return {
        success: false,
        errorCode: ERROR_CODES.GENERAL.NOT_FOUND,
        lunchpadOrder: orderData.lunchpadOrder,
        lunchpad: orderData.lunchpad,
      };
    }

    const lunchpadWalletAddress = await this.kaspaFacade.getAccountWalletAddressAtIndex(orderData.lunchpad.walletSequenceId);

    const isTransactionVerified = await this.kaspaApiService.verifyPaymentTransaction(
      transactionId,
      userWalletAddress,
      lunchpadWalletAddress,
      KaspaNetworkActionsService.KaspaToSompi(String(orderData.lunchpadOrder.totalUnits * orderData.lunchpadOrder.kasPerUnit)),
    );

    if (!isTransactionVerified) {
      return {
        success: false,
        errorCode: ERROR_CODES.LUNCHPAD.TRANSACTION_VERIFICATION_FAILED,
        lunchpadOrder: orderData.lunchpadOrder,
        lunchpad: orderData.lunchpad,
      };
    }

    let updatedOrder = null;

    // change status
    try {
      updatedOrder = await this.lunchpadService.setOrderStatusToWaitingForProcessing(orderData.lunchpadOrder._id, transactionId);
    } catch (error) {
      if (this.lunchpadService.isLunchpadInvalidStatusUpdateError(error)) {
        return {
          success: false,
          errorCode: ERROR_CODES.LUNCHPAD.INVALID_ORDER_STATUS,
          lunchpadOrder: orderData.lunchpadOrder,
          lunchpad: orderData.lunchpad,
        };
      } else {
        this.logger.error('Failed to set order status to waiting for processing');
        this.logger.error(error, error?.stack, error?.meta);
        return {
          success: false,
          errorCode: ERROR_CODES.GENERAL.UNKNOWN_ERROR,
          lunchpadOrder: orderData.lunchpadOrder,
          lunchpad: orderData.lunchpad,
        };
      }
    }

    try {
      // process order
      return await this.processOrderAfterStatusChange(updatedOrder, orderData.lunchpad);
    } catch (error) {
      this.logger.error('Failed transfering lunchpad order KRC20 Tokens');
      this.logger.error(error, error?.stack, error?.meta);

      return {
        success: false,
        errorCode: ERROR_CODES.GENERAL.UNKNOWN_ERROR,
        lunchpadOrder: orderData.lunchpadOrder,
        lunchpad: orderData.lunchpad,
      };
    }
  }

  private async processOrderAfterStatusChange(
    order: LunchpadOrder,
    lunchpad: LunchpadEntity,
  ): Promise<LunchpadOrderDataWithErrors> {
    let updatedOrder = await this.lunchpadService.setOrderStatusToProcessing(order._id);
    let updatedLunchpad = lunchpad;

    try {
      await this.kaspaFacade.verifyTokensAndProcessLunchpadOrder(updatedOrder, lunchpad, async (result) => {
        updatedOrder = await this.lunchpadService.updateOrderTransactionsResult(updatedOrder._id, result);
        if (result.commitTransactionId != updatedOrder.transactions?.commitTransactionId) {
          updatedLunchpad = await this.lunchpadService.reduceLunchpadTokenCurrentAmount(
            lunchpad,
            updatedOrder.totalUnits * updatedOrder.tokenPerUnit,
          );
        }
      });

      updatedOrder = await this.lunchpadService.setOrderCompleted(order._id);

      // don't await because not important
      // this.telegramBotService.notifyOrderCompleted(order).catch(() => {});


      return {
        success: true,
        lunchpad: updatedLunchpad,
        lunchpadOrder: updatedOrder,
      };
    } catch (error) {
      let errorCode = ERROR_CODES.GENERAL.UNKNOWN_ERROR;

      if (error instanceof PriorityFeeTooHighError) {
        await this.lunchpadService.setLowFeeErrorStatus(updatedOrder._id);
        errorCode = ERROR_CODES.KASPA.HIGH_PRIORITY_FEE;
      } else {
        await this.lunchpadService.setProcessingError(updatedOrder._id, error.toString());
        this.logger.error(error?.message, error?.stack);
        this.telegramBotService.sendErrorToErrorsChannel(error);
      }

      return {
        success: false,
        errorCode: errorCode,
        lunchpad: updatedLunchpad,
        lunchpadOrder: updatedOrder,
      };
    }
  }

  async cancelOrder(orderId, walletAddress): Promise<LunchpadOrderDataWithErrors> {
    const orderData = await this.getOrderByIdAndWalletAndStatus(orderId, walletAddress, LunchpadOrderStatus.WAITING_FOR_KAS);

    if (!orderData.success) {
      return orderData;
    }

    try {
      const result = await this.lunchpadService.cancelLunchpadOrder(orderData.lunchpadOrder);

      return {
        success: true,
        lunchpadOrder: result.lunchpadOrder,
        lunchpad: result.lunchpad,
      };
    } catch (error) {
      return {
        success: false,
        lunchpadOrder: orderData.lunchpadOrder,
        errorCode: ERROR_CODES.GENERAL.UNKNOWN_ERROR,
      };
    }
  }

  async getOrderByIdAndWalletAndStatus(
    orderId: string,
    walletAddress: string,
    status: LunchpadOrderStatus,
    withLunchpad = false,
  ): Promise<LunchpadOrderDataWithErrors> {
    const order = await this.lunchpadService.getOrderByIdAndWallet(orderId, walletAddress);
    let lunchpad = null;

    if (!order) {
      return {
        success: false,
        errorCode: ERROR_CODES.GENERAL.NOT_FOUND,
        lunchpadOrder: null,
      };
    }

    if (order.status !== status) {
      return {
        success: false,
        errorCode: ERROR_CODES.LUNCHPAD.INVALID_ORDER_STATUS,
        lunchpadOrder: order,
      };
    }

    if (withLunchpad) {
      lunchpad = await this.lunchpadService.getById(order.lunchpadId);
    }

    return {
      success: true,
      lunchpadOrder: order,
      lunchpad,
    };
  }
}
