import { Injectable } from '@nestjs/common';
import {
  ACCEPTABLE_TRANSACTION_AMOUNT_RANGE,
  AMOUNT_FOR_SWAP_FEES,
  KaspaNetworkActionsService,
  LISTING_PSKT_TRANSACTION_AMOUNT_RANGE,
} from '../services/kaspa-network/kaspa-network-actions.service';
import { WalletAccount } from '../services/kaspa-network/interfaces/wallet-account.interface';
import { P2pOrderEntity } from '../model/schemas/p2p-order.schema';
import { KasplexApiService } from '../services/kasplex-api/services/kasplex-api.service';
import { SwapTransactionsResult } from '../services/kaspa-network/interfaces/SwapTransactionsResult.interface';
import { LunchpadOrder } from '../model/schemas/lunchpad-order.schema';
import { KRC20ActionTransations } from '../services/kaspa-network/interfaces/Krc20ActionTransactions.interface';
import { LunchpadEntity } from '../model/schemas/lunchpad.schema';
import { LunchpadWalletTokenBalanceIncorrect } from '../services/kaspa-network/errors/LunchpadWalletTokenBalanceIncorrect';
import { BatchMintEntity } from '../model/schemas/batch-mint.schema';
import { Krc20TransactionsResult } from '../services/kaspa-network/interfaces/Krc20TransactionsResult.interface';
import { isEmptyString } from '../utils/object.utils';
import { TotalBalanceWithUtxosInterface } from '../services/kaspa-network/interfaces/TotalBalanceWithUtxos.interface';
import { UtxoEntry } from 'libs/kaspa/kaspa';
import { IncorrectUtxoAmountForBatchMint } from '../services/kaspa-network/errors/batch-mint/IncorrectUtxoAmountForBatchMint';
import { IncorrectKaspaAmountForBatchMint } from '../services/kaspa-network/errors/batch-mint/IncorrectKaspaAmountForBatchMint';
import { BatchMintUnknownMoneyError } from '../services/kaspa-network/errors/batch-mint/BatchMintUnknownMoneyError';
import { UtilsHelper } from '../helpers/utils.helper';
import { SellOrderV2Dto } from '../model/dtos/p2p-orders/sell-order-v2.dto';
import { AppLogger } from 'src/modules/core/modules/logger/app-logger.abstract';
import { AppConfigService } from 'src/modules/core/modules/config/app-config.service';
import { MIN_COMMISSION } from '../model/schemas/p2p-order-v2.schema';
import { SellOrderPskt } from '../services/kaspa-network/interfaces/SellOrderPskt.interface';
import * as _ from 'loadsh';
import { OperationType } from '../services/kasplex-api/model/token-operation.interface';

@Injectable()
export class KaspaFacade {
  constructor(
    private readonly kaspaNetworkActionsService: KaspaNetworkActionsService,
    private readonly kasplexApiService: KasplexApiService,
    private readonly utils: UtilsHelper,
    private readonly logger: AppLogger,
    private readonly config: AppConfigService,
  ) {}

  async verifyPsktSellOrder(
    orderData: SellOrderV2Dto,
    walletAddress: string,
  ): Promise<{ isVerified: boolean; error: any; psktTransactionId: string }> {
    let psktTransactionId = null;
    let validationError = null;

    try {
      const psktData: SellOrderPskt = JSON.parse(orderData.psktSeller);

      if (psktData?.inputs?.length !== 1) {
        throw new Error('Pskt invalid inputs amount');
      }

      psktTransactionId = psktData?.inputs[0]?.transactionId;

      if (!psktTransactionId) {
        throw new Error('Pskt transaction id is missing');
      }

      const commission = this.calculateSellOrderCommission(orderData.totalPrice);

      let outputsAmount = 2;

      if (!commission) {
        outputsAmount = 1;
      }

      if (psktData?.outputs.length !== outputsAmount) {
        throw new Error('Pskt invalid outputs amount');
      }

      const outputByWalletAddress = _.keyBy(psktData.outputs, (output) =>
        this.kaspaNetworkActionsService.getWalletAddressFromScriptPublicKey(output.scriptPublicKey),
      );

      if (
        !(
          outputByWalletAddress[walletAddress]?.value &&
          BigInt(outputByWalletAddress[walletAddress].value) >=
            KaspaNetworkActionsService.KaspaToSompiFromNumber(orderData.totalPrice) &&
          BigInt(outputByWalletAddress[walletAddress].value) <=
            KaspaNetworkActionsService.KaspaToSompiFromNumber(orderData.totalPrice + LISTING_PSKT_TRANSACTION_AMOUNT_RANGE)
        )
      ) {
        throw new Error('Pskt invalid order total amount');
      }

      if (
        commission &&
        outputByWalletAddress[this.config.commitionWalletAddress]?.value &&
        BigInt(outputByWalletAddress[this.config.commitionWalletAddress].value) !=
          KaspaNetworkActionsService.KaspaToSompiFromNumber(commission)
      ) {
        throw new Error('Pskt invalid commission amount');
      }

      const kasplexOperationsData = await this.utils.retryOnError(
        async () => await this.kasplexApiService.fetchOperationResults(psktTransactionId),
        15,
        2000,
        true,
      );

      const operationData = kasplexOperationsData && kasplexOperationsData[0];

      if (!operationData) {
        throw new Error('Kasplex operation data not found');
      }

      if (operationData.op != OperationType.LIST) {
        throw new Error('Pskt invalid operation type');
      }

      if (BigInt(operationData.amt) != KaspaNetworkActionsService.KaspaToSompiFromNumber(orderData.quantity)) {
        throw new Error('Pskt invalid order quantity');
      }

      if (operationData.tick != orderData.ticker) {
        throw new Error('Pskt invalid order ticker');
      }

      if (operationData.from != walletAddress) {
        throw new Error('Pskt invalid order wallet address');
      }

      return {
        isVerified: true,
        error: null,
        psktTransactionId,
      };
    } catch (err) {
      this.logger.error(err?.message || err, err?.stack, err?.trace);
      validationError = err;
    }

    return {
      isVerified: false,
      error: validationError,
      psktTransactionId,
    };
  }

  calculateSellOrderCommission(totalPrice: number): number {
    if (!this.config.swapCommissionPercentage) {
      return 0;
    }

    return Math.max((totalPrice * this.config.swapCommissionPercentage) / 100, MIN_COMMISSION);
  }

  async getAccountWalletAddressAtIndex(sequenceId: number): Promise<string> {
    const walletAccount: WalletAccount = await this.kaspaNetworkActionsService.getWalletAccountAtIndex(sequenceId);
    return walletAccount.address;
  }

  async checkIfWalletHasKrc20Token(address: string, ticker: string, amount: number): Promise<boolean> {
    const walletTokensAmount = await this.getKrc20TokenBalance(address, ticker);

    return walletTokensAmount >= KaspaNetworkActionsService.KaspaToSompiFromNumber(amount);
  }

  async getKrc20TokenBalance(address: string, ticker: string): Promise<bigint> {
    return await this.kasplexApiService.fetchWalletBalance(address, ticker);
  }

  async verifyTransactionResultWithKaspaApiAndWalletTotalAmountWithSwapFee(
    transactionId: string,
    from: string,
    to: string,
    amount: number = 0,
    acceptableAmountRange: number = 0,
  ): Promise<boolean> {
    return await this.kaspaNetworkActionsService.verifyTransactionResultWithKaspaApiAndWalletTotalAmount(
      transactionId,
      from,
      to,
      KaspaNetworkActionsService.KaspaToSompiFromNumber(amount) + AMOUNT_FOR_SWAP_FEES,
      KaspaNetworkActionsService.KaspaToSompiFromNumber(acceptableAmountRange),
    );
  }

  async getWalletBalanceAndUtxos(walletSequenceId: number): Promise<TotalBalanceWithUtxosInterface> {
    const walletAccount: WalletAccount = await this.kaspaNetworkActionsService.getWalletAccountAtIndex(walletSequenceId);

    return await this.kaspaNetworkActionsService.getWalletTotalBalanceAndUtxos(walletAccount.address);
  }

  async checkIfWalletHasValidKaspaAmountForSwap(order: P2pOrderEntity): Promise<boolean> {
    const swapWallet = await this.getAccountWalletAddressAtIndex(order.walletSequenceId);
    const isValidData = await this.kaspaNetworkActionsService.isValidKaspaAmountForSwap(
      swapWallet,
      KaspaNetworkActionsService.KaspaToSompiFromNumber(order.totalPrice),
    );

    return isValidData.isValid;
  }

  async getUtxoSenderWallet(
    receiverWalletAddress: string,
    utxoEntry: UtxoEntry,
    acceptableAmountRange: number = 0,
  ): Promise<any> {
    return await this.kaspaNetworkActionsService.getTransactionSenderWallet(
      utxoEntry.outpoint.transactionId,
      receiverWalletAddress,
      utxoEntry.amount,
      KaspaNetworkActionsService.KaspaToSompiFromNumber(acceptableAmountRange),
    );
  }

  async doSellSwap(
    order: P2pOrderEntity,
    notifyUpdate: (result: Partial<SwapTransactionsResult>) => Promise<void>,
  ): Promise<SwapTransactionsResult> {
    try {
      const walletAccount: WalletAccount = await this.kaspaNetworkActionsService.getWalletAccountAtIndex(order.walletSequenceId);
      const holderWalletPrivateKey = walletAccount.privateKey;

      const quantity = KaspaNetworkActionsService.KaspaToSompiFromNumber(order.quantity);
      const totalPrice = KaspaNetworkActionsService.KaspaToSompiFromNumber(order.totalPrice);

      return await this.kaspaNetworkActionsService.doSellSwap(
        holderWalletPrivateKey,
        order.buyerWalletAddress,
        order.sellerWalletAddress,
        order.ticker,
        quantity,
        totalPrice,
        order.transactions || {},
        notifyUpdate,
      );
    } catch (error) {
      throw error;
    }
  }

  async delistSellSwap(
    order: P2pOrderEntity,
    notifyUpdate: (result: Partial<SwapTransactionsResult>) => Promise<void>,
  ): Promise<Partial<SwapTransactionsResult>> {
    const walletAccount: WalletAccount = await this.kaspaNetworkActionsService.getWalletAccountAtIndex(order.walletSequenceId);
    const holderWalletPrivateKey = walletAccount.privateKey;

    const quantity = KaspaNetworkActionsService.KaspaToSompiFromNumber(order.quantity);

    return await this.kaspaNetworkActionsService.cancelSellSwap(
      holderWalletPrivateKey,
      order.sellerWalletAddress,
      order.ticker,
      quantity,
      order.transactions || {},
      notifyUpdate,
    );
  }

  async verifyLunchpadTokensAmount(lunchpad: LunchpadEntity) {
    const lunchpadSenderWallet = await this.kaspaNetworkActionsService.getWalletAccountAtIndex(lunchpad.senderWalletSequenceId);

    const lunchpadSenderWalletTokensAmount = KaspaNetworkActionsService.SompiToNumber(
      await this.getKrc20TokenBalance(lunchpadSenderWallet.address, lunchpad.ticker),
    );

    if (lunchpadSenderWalletTokensAmount < lunchpad.currentTokensAmount) {
      throw new LunchpadWalletTokenBalanceIncorrect(
        lunchpad.ticker,
        lunchpadSenderWallet.address,
        lunchpad.currentTokensAmount,
        lunchpadSenderWalletTokensAmount,
      );
    }
  }

  async processLunchpadOrder(
    lunchpadOrder: LunchpadOrder,
    lunchpad: LunchpadEntity,
    notifyUpdate: (result: Partial<KRC20ActionTransations>) => Promise<void>,
  ): Promise<KRC20ActionTransations> {
    // Verify wallet amount
    const lunchpadSenderWallet = await this.kaspaNetworkActionsService.getWalletAccountAtIndex(lunchpad.senderWalletSequenceId);

    return await this.kaspaNetworkActionsService.transferKrc20TokenAndNotify(
      lunchpadSenderWallet.privateKey,
      lunchpadOrder.userWalletAddress,
      lunchpad.ticker,
      KaspaNetworkActionsService.KaspaToSompiFromNumber(lunchpadOrder.totalUnits * lunchpad.tokenPerUnit),
      lunchpadOrder.transactions || {},
      KaspaNetworkActionsService.KaspaToSompiFromNumber(lunchpad.maxFeeRatePerTransaction),
      notifyUpdate,
      true,
      true,
    );
  }

  getRequiredAmountForBatchMint(totalMints: number, maxPriorityFee: number): number {
    return KaspaNetworkActionsService.SompiToNumber(
      this.kaspaNetworkActionsService.getRequiredKaspaAmountForBatchMint(
        totalMints,
        KaspaNetworkActionsService.KaspaToSompiFromNumber(maxPriorityFee),
      ),
    );
  }

  getRequiredKaspaAmountForLunchpad(totalUnits: number, minUnits: number, maxPriorityFee: number): number {
    return KaspaNetworkActionsService.SompiToNumber(
      this.kaspaNetworkActionsService.getRequiredKaspaAmountForLunchpad(
        totalUnits,
        minUnits,
        KaspaNetworkActionsService.KaspaToSompiFromNumber(maxPriorityFee),
      ),
    );
  }

  async validateBatchMintWalletAmount(batchMintEntity: BatchMintEntity): Promise<boolean> {
    const walletAccount: WalletAccount = await this.kaspaNetworkActionsService.getWalletAccountAtIndex(
      batchMintEntity.walletSequenceId,
    );

    const walletUtxoData = await this.getWalletBalanceAndUtxos(batchMintEntity.walletSequenceId);

    const requiredKaspaAmount = this.kaspaNetworkActionsService.getRequiredKaspaAmountForBatchMint(
      batchMintEntity.totalMints,
      KaspaNetworkActionsService.KaspaToSompiFromNumber(batchMintEntity.maxPriorityFee),
    );

    if (
      requiredKaspaAmount >
      walletUtxoData.totalBalance + KaspaNetworkActionsService.KaspaToSompiFromNumber(ACCEPTABLE_TRANSACTION_AMOUNT_RANGE)
    ) {
      throw new IncorrectKaspaAmountForBatchMint(walletUtxoData.totalBalance, requiredKaspaAmount, batchMintEntity);
    }

    if (batchMintEntity.finishedMints == 0) {
      if (walletUtxoData.utxoEntries.length != 1) {
        throw new IncorrectUtxoAmountForBatchMint(walletUtxoData.utxoEntries.length, 1, batchMintEntity);
      }

      if (
        !(await this.kaspaNetworkActionsService.verifyPaymentTransaction(
          walletUtxoData.utxoEntries[0].outpoint.transactionId,
          batchMintEntity.ownerWallet,
          walletAccount.address,
          requiredKaspaAmount,
          KaspaNetworkActionsService.KaspaToSompiFromNumber(ACCEPTABLE_TRANSACTION_AMOUNT_RANGE),
        ))
      ) {
        throw new BatchMintUnknownMoneyError(walletUtxoData.totalBalance, requiredKaspaAmount, batchMintEntity);
      }
    }

    return true;
  }

  async getLunchpadComission(walletSequenceId: number): Promise<bigint> {
    return await this.kaspaNetworkActionsService.getLunchpadCommissionInSompi(walletSequenceId);
  }

  async transferAllKrc20AndKaspaTokens(
    walletSequenceId: number,
    targetWallet: string,
    maxPriorityFee: bigint,
    commission: bigint = 0n,
  ) {
    await this.kasplexApiService.waitForIndexerToBeSynced();
    const originWallet = await this.kaspaNetworkActionsService.getWalletAccountAtIndex(walletSequenceId);

    const walletKrc20Tokens = await this.kasplexApiService.getAddressTokenList(originWallet.address);

    console.log('walletKrc20Tokens', walletKrc20Tokens);

    for (const krc20Token of walletKrc20Tokens.result) {
      await this.kaspaNetworkActionsService.transferKrc20TokenAndNotify(
        originWallet.privateKey,
        targetWallet,
        krc20Token.tick,
        BigInt(krc20Token.balance),
        {},
        maxPriorityFee,
        async () => {},
      );
    }

    await this.kaspaNetworkActionsService.transferAllRemainingKaspa(
      originWallet.privateKey,
      maxPriorityFee,
      targetWallet,
      async () => {},
      commission,
    );
  }

  async doBatchMint(
    batchMintEntity: BatchMintEntity,
    notifyUpdate: (result: Partial<Krc20TransactionsResult>) => Promise<void>,
    notifyUpdateTransferTransaction: (result: Partial<KRC20ActionTransations>) => Promise<void>,
    notifyUpdateKasRefundTransaction: (result: string) => Promise<void>,
    getUpdatedBatchMintEntity: () => BatchMintEntity,
  ): Promise<{
    isMintOver: boolean;
    refundTransactionId: string;
    commission: number;
  }> {
    const batchMintWallet = await this.kaspaNetworkActionsService.getWalletAccountAtIndex(batchMintEntity.walletSequenceId);

    const finishedTransactionsLength = (batchMintEntity.transactions && batchMintEntity.transactions.length) || 0;
    let isMintOver = false;

    let lastTransactions: Partial<KRC20ActionTransations> =
      batchMintEntity.transactions && finishedTransactionsLength
        ? batchMintEntity.transactions[finishedTransactionsLength - 1]
        : {};

    let timesLeftToRun = batchMintEntity.totalMints - finishedTransactionsLength;

    if (!isEmptyString(lastTransactions.commitTransactionId) && isEmptyString(lastTransactions.revealTransactionId)) {
      timesLeftToRun++;
    } else {
      lastTransactions = {};
    }

    let updatedBatchMintEntity = getUpdatedBatchMintEntity();

    for (let completedRuns = 0; completedRuns < timesLeftToRun; completedRuns++) {
      console.log('completedRuns', completedRuns);

      if (Object.keys(lastTransactions).length == 0) {
        updatedBatchMintEntity = getUpdatedBatchMintEntity();

        if (updatedBatchMintEntity.isUserCanceled) {
          console.log('USER CANCELLED BREAK');
          break;
        }

        const mintsLeft = await this.kasplexApiService.getTokenRemainingMints(batchMintEntity.ticker);

        console.log('REMAINING MINTS', mintsLeft);

        if (mintsLeft <= batchMintEntity.stopMintsAtMintsLeft) {
          console.log('BREAKING');
          isMintOver = true;
          break;
        }
      }

      await this.kaspaNetworkActionsService.mintAndNotify(
        batchMintWallet.privateKey,
        batchMintEntity.ticker,
        KaspaNetworkActionsService.KaspaToSompi(batchMintEntity.maxPriorityFee.toFixed(8)),
        lastTransactions,
        notifyUpdate,
      );

      lastTransactions = {};
    }

    updatedBatchMintEntity = getUpdatedBatchMintEntity();

    console.log('TOTAL COMPLETED MINTS', updatedBatchMintEntity.finishedMints);

    if (updatedBatchMintEntity.finishedMints > 0) {
      if (!(updatedBatchMintEntity.transactions && updatedBatchMintEntity.transactions.length)) {
        throw new Error('No transactions for batch mint while finished mints > 0');
      }

      const lastTransactionReveal =
        updatedBatchMintEntity.transactions[updatedBatchMintEntity.transactions.length - 1].revealTransactionId;

      if (!lastTransactionReveal) {
        throw new Error('No last reveal transaction for batch mint');
      }

      await this.kasplexApiService.waitForIndexerToBeSynced();

      await this.utils.retryOnError(
        async () => {
          const verifyLastTransactionAtKasplexData = await this.kasplexApiService.fetchOperationResults(lastTransactionReveal);

          if (!verifyLastTransactionAtKasplexData) {
            throw new Error('Operation not found at kasplex');
          }
        },
        30,
        2000,
        true,
      );

      const tokenAmountToSend = await this.kasplexApiService.fetchWalletBalance(
        batchMintWallet.address,
        updatedBatchMintEntity.ticker,
      );

      if (tokenAmountToSend > 0n) {
        await this.kaspaNetworkActionsService.transferKrc20TokenAndNotify(
          batchMintWallet.privateKey,
          batchMintEntity.ownerWallet,
          batchMintEntity.ticker,
          tokenAmountToSend,
          batchMintEntity.transferTokenTransactions || {},
          KaspaNetworkActionsService.KaspaToSompi(batchMintEntity.maxPriorityFee.toFixed(8)),
          notifyUpdateTransferTransaction,
        );
      }
    }

    const commission =
      updatedBatchMintEntity.finishedMints > 0
        ? this.kaspaNetworkActionsService.getBatchMintCommissionInSompi(updatedBatchMintEntity.finishedMints)
        : null;

    const refundTransaction = await this.kaspaNetworkActionsService.transferAllRemainingKaspa(
      batchMintWallet.privateKey,
      KaspaNetworkActionsService.KaspaToSompi(batchMintEntity.maxPriorityFee.toFixed(8)),
      batchMintEntity.ownerWallet,
      notifyUpdateKasRefundTransaction,
      commission,
    );

    return {
      isMintOver,
      refundTransactionId: refundTransaction.summary.finalTransactionId,
      commission: KaspaNetworkActionsService.SompiToNumber(commission),
    };
  }
}
