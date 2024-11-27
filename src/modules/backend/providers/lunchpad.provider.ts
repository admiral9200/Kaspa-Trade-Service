import { Injectable } from '@nestjs/common';
import { KaspaFacade } from '../facades/kaspa.facade';
import { TemporaryWalletSequenceService } from '../services/temporary-wallet-sequence.service';
import {
  ACCEPTABLE_TRANSACTION_AMOUNT_RANGE,
  KaspaNetworkActionsService,
} from '../services/kaspa-network/kaspa-network-actions.service';
import { AppLogger } from 'src/modules/core/modules/logger/app-logger.abstract';
import { ALLOWED_UPDATE_STATUSES_FOR_LUNCHPAD, LunchpadService } from '../services/lunchpad.service';
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
import * as _ from 'lodash';
import { UpdateLunchpadRequestDto } from '../model/dtos/lunchpad/update-lunchpad-request.dto';
import { LunchpadNotEnoughUserAvailableQtyError } from '../services/kaspa-network/errors/LunchpadNotEnoughUserAvailableQtyError';
import { GetLunchpadOrderListDto } from '../model/dtos/lunchpad/get-lunchpad-order-list';

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

    let lunchpad = null;
    try {
      lunchpad = await this.lunchpadService.createLunchpad(
        createLunchpadDto,
        ownerWalletAddress,
        senderWalletSequenceId,
        receiverWalletSequenceId,
      );
    } catch (e) {
      console.error('Failed to create lunchpad', createLunchpadDto, e);
      return {
        success: false,
        errorCode: ERROR_CODES.GENERAL.UNKNOWN_ERROR,
        lunchpad: null,
        walletAddress: null,
      };
    }

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

  async updateLunchpad(
    id: string,
    updateLunchpadDto: UpdateLunchpadRequestDto,
    ownerWalletAddress: string,
  ): Promise<LunchpadDataWithWallet> {
    let lunchpad = await this.lunchpadService.getByIdAndOwner(id, ownerWalletAddress);

    if (!lunchpad) {
      return {
        success: false,
        errorCode: ERROR_CODES.GENERAL.NOT_FOUND,
        lunchpad: null,
        walletAddress: null,
      };
    }

    if (!ALLOWED_UPDATE_STATUSES_FOR_LUNCHPAD.includes(lunchpad.status)) {
      return {
        success: false,
        errorCode: ERROR_CODES.LUNCHPAD.INVALID_LUNCHPAD_STATUS,
        lunchpad: lunchpad,
        walletAddress: null,
      };
    }

    try {
      lunchpad = await this.lunchpadService.updateLunchpad(id, updateLunchpadDto, ownerWalletAddress);
    } catch (e) {
      console.error('Failed to update lunchpad', updateLunchpadDto, e);
      return {
        success: false,
        errorCode: ERROR_CODES.GENERAL.UNKNOWN_ERROR,
        lunchpad: null,
        walletAddress: null,
      };
    }

    if (!lunchpad) {
      console.error('Failed to create lunchpad', updateLunchpadDto, lunchpad);
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

  async startLunchpad(id: string, ownerWalletAddress: string, estimateOnly: boolean = false): Promise<LunchpadDataWithWallet> {
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

    if (estimateOnly) {
      return {
        success: true,
        walletAddress: receiverWalletAddress,
        senderWalletAddress,
        lunchpad,
        krc20TokensAmount: krc20TokenAmount,
        requiredKaspa,
      };
    }

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

    if (![LunchpadStatus.ACTIVE, LunchpadStatus.SOLD_OUT, LunchpadStatus.NO_UNITS_LEFT].includes(lunchpad.status)) {
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

  async isWalletWhitelisted(ticker: string, walletAddress: string): Promise<LunchpadDataWithWallet> {
    const lunchpad = await this.lunchpadService.getByTicker(ticker);

    if (!lunchpad) {
      return {
        success: false,
        errorCode: ERROR_CODES.GENERAL.NOT_FOUND,
        lunchpad: null,
        walletAddress: null,
      };
    }

    if (lunchpad.useWhitelist && !(lunchpad.whitelistWalletAddresses || []).includes(walletAddress)) {
      return {
        success: false,
        errorCode: ERROR_CODES.LUNCHPAD.WALLET_NOT_IN_WHITELIST,
        lunchpad: lunchpad,
        walletAddress: null,
      };
    }
    return {
      success: true,
      lunchpad: lunchpad,
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

    if (lunchpad.useWhitelist && !(lunchpad.whitelistWalletAddresses || []).includes(orderCreatorWallet)) {
      return {
        success: false,
        errorCode: ERROR_CODES.LUNCHPAD.WALLET_NOT_IN_WHITELIST,
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
      if (!(error instanceof LunchpadNotEnoughAvailableQtyError || error instanceof LunchpadNotEnoughUserAvailableQtyError)) {
        this.logger.error('Failed to create lunchpad order');
        this.logger.error(error, error?.stack, error?.meta);
      }

      let errorCode = ERROR_CODES.GENERAL.UNKNOWN_ERROR;

      if (error instanceof LunchpadNotEnoughAvailableQtyError) {
        errorCode = ERROR_CODES.LUNCHPAD.LUNCHPAD_UNITS_EXCEEDS;
      }

      if (error instanceof LunchpadNotEnoughUserAvailableQtyError) {
        errorCode = ERROR_CODES.LUNCHPAD.LUNCHPAD_WALLET_UNITS_EXCEEDS;
      }

      return {
        success: false,
        errorCode,
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

    if (![LunchpadStatus.ACTIVE, LunchpadStatus.NO_UNITS_LEFT].includes(orderData.lunchpad.status)) {
      return {
        success: false,
        errorCode: ERROR_CODES.LUNCHPAD.INVALID_LUNCHPAD_STATUS,
        lunchpadOrder: orderData.lunchpadOrder,
        lunchpad: orderData.lunchpad,
      };
    }

    if (orderData.lunchpadOrder.roundNumber != orderData.lunchpad.roundNumber) {
      return {
        success: false,
        errorCode: ERROR_CODES.LUNCHPAD.INVALID_ORDER_ROUND_NUMBER,
        lunchpadOrder: orderData.lunchpadOrder,
        lunchpad: orderData.lunchpad,
      };
    }

    const lunchpadReceiverWalletAddress = await this.kaspaFacade.getAccountWalletAddressAtIndex(
      orderData.lunchpad.receiverWalletSequenceId,
    );

    let isTransactionVerified = false;

    try {
      isTransactionVerified = await this.kaspaApiService.verifyPaymentTransaction(
        transactionId,
        userWalletAddress,
        lunchpadReceiverWalletAddress,
        KaspaNetworkActionsService.KaspaToSompiFromNumber(orderData.lunchpadOrder.totalUnits * orderData.lunchpad.kasPerUnit),
        false,
        KaspaNetworkActionsService.KaspaToSompiFromNumber(ACCEPTABLE_TRANSACTION_AMOUNT_RANGE),
      );
    } catch (error) {
      this.logger.error('Failed to verify payment transaction');
      this.logger.error(error, error?.stack, error?.meta);
    }

    if (!isTransactionVerified) {
      return {
        success: false,
        errorCode: ERROR_CODES.LUNCHPAD.TRANSACTION_VERIFICATION_FAILED,
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
    if (![LunchpadStatus.ACTIVE, LunchpadStatus.STOPPING, LunchpadStatus.NO_UNITS_LEFT].includes(lunchpad.status)) {
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
    let updatedLunchpad = lunchpad;

    await this.kaspaFacade.processLunchpadOrder(updatedOrder, lunchpad, async (result) => {
      updatedOrder = await this.lunchpadService.updateOrderTransactionsResult(updatedOrder._id, result);
      if (result.commitTransactionId && !updatedOrder.transactions?.commitTransactionId) {
        updatedLunchpad = await this.lunchpadService.reduceLunchpadTokenCurrentAmount(
          updatedLunchpad,
          updatedOrder.totalUnits * lunchpad.tokenPerUnit,
        );
      }
    });

    updatedLunchpad = await this.lunchpadService.checkIfLunchpadNeedsStatusChangeAfterOrderCompleted(updatedLunchpad);

    return await this.lunchpadService.setOrderCompleted(order._id);
  }

  async cancelOrder(orderId, walletAddress): Promise<LunchpadOrderDataWithErrors> {
    const orderData = await this.getOrderByIdAndWalletAndStatus(
      orderId,
      walletAddress,
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

    if (orderData.lunchpad.roundNumber != orderData.lunchpadOrder.roundNumber) {
      return {
        success: false,
        errorCode: ERROR_CODES.LUNCHPAD.INVALID_ORDER_ROUND_NUMBER,
        lunchpadOrder: orderData.lunchpadOrder,
        lunchpad: orderData.lunchpad,
      };
    }

    if (![LunchpadStatus.ACTIVE, LunchpadStatus.NO_UNITS_LEFT].includes(orderData.lunchpad.status)) {
      return {
        success: false,
        errorCode: ERROR_CODES.LUNCHPAD.INVALID_LUNCHPAD_STATUS,
        lunchpadOrder: orderData.lunchpadOrder,
        lunchpad: orderData.lunchpad,
      };
    }

    const lunchpadReceiverWalletAddress = await this.kaspaFacade.getAccountWalletAddressAtIndex(
      orderData.lunchpad.receiverWalletSequenceId,
    );

    const orderUnitsData = this.lunchpadService.getLunchpadOrderUnits(orderData.lunchpad, orderData.lunchpadOrder);

    let isTransactionVerified = false;

    try {
      isTransactionVerified = await this.kaspaApiService.verifyPaymentTransaction(
        orderData.lunchpadOrder.userTransactionId,
        orderData.lunchpadOrder.userWalletAddress,
        lunchpadReceiverWalletAddress,
        KaspaNetworkActionsService.KaspaToSompiFromNumber(orderData.lunchpadOrder.totalUnits * orderUnitsData.kasPerUnit),
      );
    } catch (error) {
      this.logger.error(error, error?.stack, error?.meta);
    }

    if (isTransactionVerified) {
      orderData.lunchpadOrder = await this.lunchpadService.setOrderStatusToVerifiedAndWaitingForProcessing(
        orderData.lunchpadOrder._id,
      );
      this.startLunchpadProcessingOrdersIfNeeded(orderData.lunchpad);

      return {
        success: false,
        lunchpad: orderData.lunchpad,
        lunchpadOrder: orderData.lunchpadOrder,
        errorCode: ERROR_CODES.LUNCHPAD.ORDER_HAS_TRANSFERED_KAS,
      };
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
          KaspaNetworkActionsService.KaspaToSompiFromNumber(lunchpad.maxFeeRatePerTransaction),
        );
      } else if (walletType === LunchpadWalletType.RECEIVER) {
        const commission = await this.kaspaFacade.getLunchpadComission(lunchpad.receiverWalletSequenceId);

        await this.kaspaFacade.transferAllKrc20AndKaspaTokens(
          lunchpad.receiverWalletSequenceId,
          lunchpad.ownerWallet,
          KaspaNetworkActionsService.KaspaToSompiFromNumber(lunchpad.maxFeeRatePerTransaction),
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

  // ===============================================================
  // CRON JOB ACTIONS
  // ===============================================================
  async handleWaitingKasLunchpadOrders() {
    const lunchpdIds = await this.lunchpadService.getLunchpadIdsWithWaitingForKasTooLongOrders();

    if (lunchpdIds.length > 0) {
      this.logger.info(`Handling waiting for kas lunchpads - ${lunchpdIds.length} lunchpads with orders found`);
    }

    for (const lunchpdId of lunchpdIds) {
      try {
        await this.handleLunchpadWaitingForKasOrders(lunchpdId);
      } catch (error) {
        console.error('Failed in handling waiting for token orders', error);
      }
    }
  }

  private async handleLunchpadWaitingForKasOrders(lunchpadId: string) {
    const lunchpad = await this.lunchpadService.getById(lunchpadId);
    if (!lunchpad) {
      return;
    }

    let waitingForKasOrders = await this.lunchpadService.getLunchpadWaitingForKasOrders(lunchpad);
    const usedTransactions = await this.lunchpadService.getOrdersUsedTransactionsForLunchpad(lunchpadId);
    const receiverWalletBalance = await this.kaspaFacade.getWalletBalanceAndUtxos(lunchpad.receiverWalletSequenceId);
    const receiverWalletAddress = await this.kaspaFacade.getAccountWalletAddressAtIndex(lunchpad.receiverWalletSequenceId);

    const freeUtxos = receiverWalletBalance.utxoEntries.filter((utxo) => !usedTransactions.includes(utxo.outpoint.transactionId));

    const freeUtxosWithSenderAddress = [];
    const transactionsSenderPromises = [];

    for (const utxo of freeUtxos) {
      transactionsSenderPromises.push(
        this.kaspaFacade.getUtxoSenderWallet(receiverWalletAddress, utxo).then((senderAddress) => {
          freeUtxosWithSenderAddress.push({ utxo, senderAddress });
        }),
      );
    }

    await Promise.all(transactionsSenderPromises);

    const freeUtxosWithSenderAddressSorted = _.sortBy(freeUtxosWithSenderAddress, ['utxo.blockDaaScore']);

    for (const freeUtxosWithSenderAddress of freeUtxosWithSenderAddressSorted) {
      waitingForKasOrders = await this.handleFreeUtxoWithSenderAddress(lunchpad, freeUtxosWithSenderAddress, waitingForKasOrders);
    }

    for (const notSentOrder of waitingForKasOrders) {
      try {
        await this.lunchpadService.cancelLunchpadOrder(notSentOrder);
      } catch (error) {
        console.error('Failed to cancel lunchpad order', error, notSentOrder);
      }
    }

    await this.startLunchpadProcessingOrdersIfNeeded(await this.lunchpadService.getById(lunchpad._id));
  }

  private async handleFreeUtxoWithSenderAddress(lunchpad: LunchpadEntity, freeUtxosWithSenderAddress, waitingForKasOrders) {
    if (!freeUtxosWithSenderAddress.senderAddress) {
      throw new Error(
        'No sender address at utxo at lunchpad ' +
          lunchpad._id +
          ', transaction:  ' +
          freeUtxosWithSenderAddress.utxo?.outpoint?.transactionId,
      );
    }

    const utxoAmount = KaspaNetworkActionsService.SompiToNumber(BigInt(freeUtxosWithSenderAddress.utxo.amount));
    const units = Math.floor((utxoAmount + ACCEPTABLE_TRANSACTION_AMOUNT_RANGE) / lunchpad.kasPerUnit);

    const matchingOrder = waitingForKasOrders.find(
      (order) => order.totalUnits === units && order.userWalletAddress === freeUtxosWithSenderAddress.senderAddress,
    );

    if (matchingOrder) {
      try {
        await this.lunchpadService.setOrderStatusToVerifiedAndWaitingForProcessing(
          matchingOrder._id,
          freeUtxosWithSenderAddress.utxo.outpoint.transactionId,
        );

        return waitingForKasOrders.filter((order) => order._id !== matchingOrder._id);
      } catch (error) {
        console.error(
          'Failed in updating lunchpad order user transaction id',
          error,
          matchingOrder._id,
          freeUtxosWithSenderAddress,
        );
      }
    }

    return waitingForKasOrders;
  }

  async getLunchpadOrdersList(
    lunchpadId: string,
    getLaunchpadOrderListDto: GetLunchpadOrderListDto,
    walletAddress: string,
  ): Promise<{ orders: LunchpadOrder[]; totalCount: number }> {
    const lunchpad = await this.lunchpadService.getByIdAndOwner(lunchpadId, walletAddress);
    if (!lunchpad) {
      throw new Error('Lunchpad not found');
    }

    return await this.lunchpadService.getLunchpadOrders(lunchpadId, getLaunchpadOrderListDto);
  }
}
