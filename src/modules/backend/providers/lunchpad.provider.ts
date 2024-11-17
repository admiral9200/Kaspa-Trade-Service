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
import { TelegramBotService } from 'src/modules/shared/telegram-notifier/services/telegram-bot.service';
import { LunchpadOrder } from '../model/schemas/lunchpad-order.schema';
import { LunchpadEntity } from '../model/schemas/lunchpad.schema';
import { ImportantPromisesManager } from '../important-promises-manager/important-promises-manager';
import { LunchpadWalletType } from '../model/enums/lunchpad-wallet-type.enum';
import { GetLunchpadListDto } from '../model/dtos/lunchpad/get-lunchpad-list';

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

  async getLunchpadByTicker(ticker: string, userWalletAddress?: string): Promise<LunchpadDataWithWallet> {
    const lunchpad = await this.lunchpadService.getByTicker(ticker);

    if (!lunchpad) {
      return {
        success: false,
        errorCode: ERROR_CODES.GENERAL.NOT_FOUND,
        lunchpad: null,
        walletAddress: null,
      };
    }

    const walletAddress = await this.kaspaFacade.getAccountWalletAddressAtIndex(lunchpad.receiverWalletSequenceId);

    let requiredKaspa = null;
    let senderWalletAddress = null;
    let krc20TokensAmount = null;
    let openOrders = null;

    if (userWalletAddress) {
      if (userWalletAddress != lunchpad.ownerWallet) {
        return {
          success: false,
          errorCode: ERROR_CODES.LUNCHPAD.INVALID_USER_WALLET,
          lunchpad: null,
          walletAddress: null,
        };
      }

      senderWalletAddress = await this.kaspaFacade.getAccountWalletAddressAtIndex(lunchpad.senderWalletSequenceId);

      const krc20TokenAmountBigint = await this.kaspaFacade.getKrc20TokenBalance(senderWalletAddress, lunchpad.ticker);

      krc20TokensAmount = KaspaNetworkActionsService.SompiToNumber(krc20TokenAmountBigint);

      requiredKaspa = await this.kaspaFacade.getRequiredKaspaAmountForLunchpad(
        krc20TokensAmount / lunchpad.tokenPerUnit,
        lunchpad.minUnitsPerOrder || 1,
        lunchpad.maxFeeRatePerTransaction,
      );

      openOrders = (await this.lunchpadService.getLunchpadOpenOrders(lunchpad)).length;
    }

    return {
      success: true,
      lunchpad,
      walletAddress,
      requiredKaspa,
      senderWalletAddress,
      krc20TokensAmount,
      openOrders,
    };
  }

  async createLunchpad(createLunchpadDto: CreateLunchpadRequestDto, ownerWalletAddress: string): Promise<LunchpadDataWithWallet> {
    const senderWalletSequenceId: number = await this.temporaryWalletService.getNextSequenceId();
    const receiverWalletSequenceId: number = await this.temporaryWalletService.getNextSequenceId();

    const lunchpad = await this.lunchpadService.createLunchpad(
      createLunchpadDto,
      ownerWalletAddress,
      senderWalletSequenceId,
      receiverWalletSequenceId,
    );

    if (!lunchpad) {
      console.error('Failed to create lunchpad', createLunchpadDto, lunchpad);
      return {
        success: false,
        errorCode: ERROR_CODES.GENERAL.UNKNOWN_ERROR,
        lunchpad: null,
        walletAddress: null,
      };
    }

    const walletAddress = await this.kaspaFacade.getAccountWalletAddressAtIndex(lunchpad.receiverWalletSequenceId);
    const senderWalletAddress = await this.kaspaFacade.getAccountWalletAddressAtIndex(lunchpad.senderWalletSequenceId);

    return {
      success: true,
      lunchpad,
      walletAddress,
      senderWalletAddress,
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

    if (lunchpad.status != LunchpadStatus.INACTIVE) {
      return {
        success: false,
        errorCode: ERROR_CODES.LUNCHPAD.INVALID_LUNCHPAD_STATUS,
        lunchpad: lunchpad,
        walletAddress: null,
      };
    }

    const senderWalletAddress = await this.kaspaFacade.getAccountWalletAddressAtIndex(lunchpad.senderWalletSequenceId);
    const receiverWalletAddress = await this.kaspaFacade.getAccountWalletAddressAtIndex(lunchpad.receiverWalletSequenceId);

    const krc20TokenAmountBigint = await this.kaspaFacade.getKrc20TokenBalance(senderWalletAddress, lunchpad.ticker);

    const krc20TokenAmount = KaspaNetworkActionsService.SompiToNumber(krc20TokenAmountBigint);

    if (!krc20TokenAmount || krc20TokenAmount < lunchpad.tokenPerUnit * lunchpad.minUnitsPerOrder) {
      return {
        success: false,
        walletAddress: receiverWalletAddress,
        senderWalletAddress,
        lunchpad,
        krc20TokensAmount: krc20TokenAmount,
        errorCode: ERROR_CODES.LUNCHPAD.NOT_ENOUGH_KRC20_TOKENS,
      };
    }

    const senderWalletKaspaAmount = await this.kaspaFacade.getWalletBalanceAndUtxos(lunchpad.senderWalletSequenceId);
    const requiredKaspa = await this.kaspaFacade.getRequiredKaspaAmountForLunchpad(
      Math.floor(krc20TokenAmount / lunchpad.tokenPerUnit),
      lunchpad.minUnitsPerOrder || 1,
      lunchpad.maxFeeRatePerTransaction,
    );

    if (KaspaNetworkActionsService.SompiToNumber(senderWalletKaspaAmount.totalBalance) < requiredKaspa) {
      return {
        success: false,
        walletAddress: receiverWalletAddress,
        senderWalletAddress,
        lunchpad,
        krc20TokensAmount: krc20TokenAmount,
        errorCode: ERROR_CODES.LUNCHPAD.INVALID_SENDER_WALLET_KASPA_AMOUNT,
        requiredKaspa,
      };
    }

    let updatedLunchpad = null;

    try {
      updatedLunchpad = await this.lunchpadService.startLunchpad(lunchpad, krc20TokenAmount);
    } catch (error) {
      console.error(error);
      const isStatusError = this.lunchpadService.isLunchpadInvalidStatusUpdateError(error);

      return {
        success: false,
        errorCode: isStatusError ? ERROR_CODES.LUNCHPAD.INVALID_LUNCHPAD_STATUS : ERROR_CODES.GENERAL.UNKNOWN_ERROR,
        lunchpad: lunchpad,
        walletAddress: null,
      };
    }

    return {
      success: true,
      lunchpad: updatedLunchpad,
      krc20TokensAmount: krc20TokenAmount,
      walletAddress: receiverWalletAddress,
      requiredKaspa,
    };
  }

  async stopLunchpad(id: string, ownerWalletAddress: string): Promise<LunchpadDataWithWallet> {
    const lunchpad = await this.lunchpadService.getByIdAndOwner(id, ownerWalletAddress);

    if (!lunchpad) {
      return {
        success: false,
        errorCode: ERROR_CODES.GENERAL.NOT_FOUND,
        lunchpad: null,
        walletAddress: null,
      };
    }

    if (lunchpad.status != LunchpadStatus.ACTIVE) {
      return {
        success: false,
        errorCode: ERROR_CODES.LUNCHPAD.INVALID_LUNCHPAD_STATUS,
        lunchpad: lunchpad,
        walletAddress: null,
      };
    }

    let updatedLunchpad = null;
    try {
      updatedLunchpad = await this.lunchpadService.stopLunchpad(lunchpad);
    } catch (error) {
      console.error(error);

      const isStatusError = this.lunchpadService.isLunchpadInvalidStatusUpdateError(error);

      return {
        success: false,
        errorCode: isStatusError ? ERROR_CODES.LUNCHPAD.INVALID_LUNCHPAD_STATUS : ERROR_CODES.GENERAL.UNKNOWN_ERROR,
        lunchpad: lunchpad,
        walletAddress: null,
        openOrders: (await this.lunchpadService.getLunchpadOpenOrders(lunchpad)).length,
      };
    }

    return {
      success: true,
      lunchpad: updatedLunchpad,
      walletAddress: null,
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

  async verifyOrderAndStartLunchpadProcess(orderId, userWalletAddress, transactionId): Promise<LunchpadOrderDataWithErrors> {
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

    if (!orderData.lunchpadOrder.userTransactionId) {
      try {
        await this.lunchpadService.updateOrderUserTransactionId(orderData.lunchpadOrder._id, transactionId);
      } catch (error) {
        console.error(error);

        return {
          success: false,
          errorCode: ERROR_CODES.LUNCHPAD.TRANSACTION_VERIFICATION_FAILED,
          lunchpadOrder: orderData.lunchpadOrder,
          lunchpad: orderData.lunchpad,
        };
      }
    }

    const lunchpadReceiverWalletAddress = await this.kaspaFacade.getAccountWalletAddressAtIndex(
      orderData.lunchpad.receiverWalletSequenceId,
    );

    const isTransactionVerified = await this.kaspaApiService.verifyPaymentTransaction(
      transactionId,
      userWalletAddress,
      lunchpadReceiverWalletAddress,
      KaspaNetworkActionsService.KaspaToSompi(String(orderData.lunchpadOrder.totalUnits * orderData.lunchpad.kasPerUnit)),
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
      updatedOrder = await this.lunchpadService.setOrderStatusToVerifiedAndWaitingForProcessing(orderData.lunchpadOrder._id);
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
      await this.startLunchpadProcessingOrdersIfNeeded(orderData.lunchpad);

      return {
        success: true,
        lunchpadOrder: updatedOrder,
        lunchpad: orderData.lunchpad,
      };
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

  async startLunchpadProcessingOrdersIfNeeded(lunchpad: LunchpadEntity) {
    if (![LunchpadStatus.ACTIVE, LunchpadStatus.STOPPING].includes(lunchpad.status)) {
      return;
    }

    if (lunchpad.isRunning) {
      return;
    }

    try {
      await this.kaspaFacade.verifyLunchpadTokensAmount(lunchpad);
    } catch (error) {
      this.logger.error('Failed to verify lunchpad tokens amount');
      this.logger.error(error, error?.stack, error?.meta);
      this.telegramBotService.sendErrorToErrorsChannel(error);
      return;
    }

    await this.lunchpadService.startRunningLunchpad(lunchpad);

    let resolve = null;

    const promise = new Promise((res) => {
      resolve = res;
    });

    // Not await because might take some time
    this.runLunchpadAndProcessOrders(lunchpad)
      .catch((error) => {
        this.logger.error(error, error?.stack, error?.meta);
      })
      .finally(() => {
        this.lunchpadService.stopRunningLunchpad(lunchpad._id).finally(resolve);
      });

    ImportantPromisesManager.addPromise(promise);
  }

  async runLunchpadAndProcessOrders(lunchpad: LunchpadEntity) {
    let orders = await this.lunchpadService.getReadyToProcessOrders(lunchpad);

    while (orders.length > 0) {
      for (const order of orders) {
        try {
          await this.processOrderAfterStatusChange(order, lunchpad);
        } catch (error) {
          await this.lunchpadService.setProcessingError(order._id, error.toString());
          this.logger.error(error?.message, error?.stack);
          this.telegramBotService.sendErrorToErrorsChannel(error);
        }
      }

      orders = await this.lunchpadService.getReadyToProcessOrders(lunchpad);
    }
  }

  private async processOrderAfterStatusChange(order: LunchpadOrder, lunchpad: LunchpadEntity): Promise<LunchpadOrder> {
    let updatedOrder = await this.lunchpadService.setOrderStatusToProcessing(order._id);

    await this.kaspaFacade.processLunchpadOrder(updatedOrder, lunchpad, async (result) => {
      updatedOrder = await this.lunchpadService.updateOrderTransactionsResult(updatedOrder._id, result);
      if (result.commitTransactionId != updatedOrder.transactions?.commitTransactionId) {
        await this.lunchpadService.reduceLunchpadTokenCurrentAmount(lunchpad, updatedOrder.totalUnits * lunchpad.tokenPerUnit);
      }
    });

    return await this.lunchpadService.setOrderCompleted(order._id);
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

  async retreiveFunds(
    lunchpadId: string,
    ownerWalletAddress: string,
    walletType: LunchpadWalletType,
  ): Promise<LunchpadDataWithWallet> {
    const lunchpad = await this.lunchpadService.getByIdAndOwner(lunchpadId, ownerWalletAddress);

    if (!lunchpad) {
      return {
        success: false,
        errorCode: ERROR_CODES.GENERAL.NOT_FOUND,
        lunchpad: null,
        walletAddress: null,
      };
    }

    if (![LunchpadStatus.INACTIVE, LunchpadStatus.SOLD_OUT].includes(lunchpad.status)) {
      return {
        success: false,
        errorCode: ERROR_CODES.LUNCHPAD.INVALID_LUNCHPAD_STATUS,
        lunchpad: lunchpad,
        walletAddress: null,
      };
    }

    const openOrders = await this.lunchpadService.getLunchpadOpenOrders(lunchpad);

    if (openOrders.length > 0) {
      return {
        success: false,
        errorCode: ERROR_CODES.LUNCHPAD.LUNCHPAD_HAVE_OPEN_ORDERS,
        lunchpad: lunchpad,
        walletAddress: null,
      };
    }

    try {
      if (walletType === LunchpadWalletType.SENDER) {
        await this.kaspaFacade.transferAllKrc20AndKaspaTokens(
          lunchpad.senderWalletSequenceId,
          lunchpad.ownerWallet,
          KaspaNetworkActionsService.KaspaToSompi(String(lunchpad.maxFeeRatePerTransaction)),
        );
      } else if (walletType === LunchpadWalletType.RECEIVER) {
        const commission = await this.kaspaFacade.getLunchpadComission(lunchpad.receiverWalletSequenceId);

        await this.kaspaFacade.transferAllKrc20AndKaspaTokens(
          lunchpad.receiverWalletSequenceId,
          lunchpad.ownerWallet,
          KaspaNetworkActionsService.KaspaToSompi(String(lunchpad.maxFeeRatePerTransaction)),
          commission,
        );
      } else {
        return {
          success: false,
          errorCode: ERROR_CODES.LUNCHPAD.INVALID_WALLET_TYPE,
          lunchpad,
          walletAddress: null,
        };
      }
    } catch (error) {
      console.error(error);

      return {
        success: false,
        errorCode: ERROR_CODES.GENERAL.UNKNOWN_ERROR,
        lunchpad,
        walletAddress: null,
      };
    }

    return {
      success: true,
      lunchpad,
      walletAddress: null,
    };
  }

  async getLunchpadList(
    lunchpadListDto: GetLunchpadListDto,
    walletAddress: string,
  ): Promise<{ lunchpads: LunchpadEntity[]; totalCount: number }> {
    return await this.lunchpadService.getLunchpadList(
      lunchpadListDto.filters,
      lunchpadListDto.sort,
      lunchpadListDto.pagination,
      walletAddress,
    );
  }
}
