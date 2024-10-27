import { Injectable } from '@nestjs/common';
import { AMOUNT_FOR_SWAP_FEES, KaspaNetworkActionsService } from '../services/kaspa-network/kaspa-network-actions.service';
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

const MIN_MINTS_FOR_BATCH_MINTS = 5;
@Injectable()
export class KaspaFacade {
  constructor(
    private readonly kaspaNetworkActionsService: KaspaNetworkActionsService,
    private readonly kasplexApiService: KasplexApiService,
  ) {}

  async getAccountWalletAddressAtIndex(sequenceId: number): Promise<string> {
    const walletAccount: WalletAccount = await this.kaspaNetworkActionsService.getWalletAccountAtIndex(sequenceId);
    return walletAccount.address;
  }

  async checkIfWalletHasKrc20Token(address: string, ticker: string, amount: number): Promise<boolean> {
    const walletTokensAmount = await this.getKrc20TokenBalance(address, ticker);

    return walletTokensAmount >= KaspaNetworkActionsService.KaspaToSompi(String(amount));
  }

  async getKrc20TokenBalance(address: string, ticker: string): Promise<bigint> {
    return await this.kasplexApiService.fetchWalletBalance(address, ticker);
  }

  async verifyTransactionResultWithKaspaApiAndWalletTotalAmountWithSwapFee(
    transactionId: string,
    from: string,
    to: string,
    amount: number = 0,
  ): Promise<boolean> {
    return await this.kaspaNetworkActionsService.verifyTransactionResultWithKaspaApiAndWalletTotalAmount(
      transactionId,
      from,
      to,
      KaspaNetworkActionsService.KaspaToSompi(String(amount)) + AMOUNT_FOR_SWAP_FEES,
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
      KaspaNetworkActionsService.KaspaToSompi(String(order.totalPrice)),
    );

    return isValidData.isValid;
  }

  async getUtxoSenderWallet(receiverWalletAddress: string, utxoEntry: UtxoEntry): Promise<any> {
    return await this.kaspaNetworkActionsService.getTransactionSenderWallet(
      utxoEntry.outpoint.transactionId,
      receiverWalletAddress,
      utxoEntry.amount,
    );
  }

  async doSellSwap(
    order: P2pOrderEntity,
    notifyUpdate: (result: Partial<SwapTransactionsResult>) => Promise<void>,
  ): Promise<SwapTransactionsResult> {
    try {
      const walletAccount: WalletAccount = await this.kaspaNetworkActionsService.getWalletAccountAtIndex(order.walletSequenceId);
      const holderWalletPrivateKey = walletAccount.privateKey;

      const quantity = KaspaNetworkActionsService.KaspaToSompi(String(order.quantity));
      const totalPrice = KaspaNetworkActionsService.KaspaToSompi(`${order.totalPrice}`);

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

    const quantity = KaspaNetworkActionsService.KaspaToSompi(String(order.quantity));

    return await this.kaspaNetworkActionsService.cancelSellSwap(
      holderWalletPrivateKey,
      order.sellerWalletAddress,
      order.ticker,
      quantity,
      order.transactions || {},
      notifyUpdate,
    );
  }

  async verifyTokensAndProcessLunchpadOrder(
    lunchpadOrder: LunchpadOrder,
    lunchpad: LunchpadEntity,
    notifyUpdate: (result: Partial<KRC20ActionTransations>) => Promise<void>,
  ): Promise<KRC20ActionTransations> {
    // Verify wallet amount
    const lunchpadWallet = await this.kaspaNetworkActionsService.getWalletAccountAtIndex(lunchpad.walletSequenceId);

    const lunchpadWalletTokensAmount = KaspaNetworkActionsService.SompiToNumber(
      await this.getKrc20TokenBalance(lunchpadWallet.address, lunchpad.ticker),
    );

    if (lunchpadWalletTokensAmount != lunchpad.currentTokensAmount) {
      throw new LunchpadWalletTokenBalanceIncorrect(
        lunchpad.ticker,
        lunchpadWallet.address,
        lunchpad.currentTokensAmount,
        lunchpadWalletTokensAmount,
      );
    }

    return await this.kaspaNetworkActionsService.transferKrc20TokenAndNotify(
      lunchpadWallet.privateKey,
      lunchpadOrder.userWalletAddress,
      lunchpad.ticker,
      KaspaNetworkActionsService.KaspaToSompi(String(lunchpadOrder.totalUnits * lunchpadOrder.tokenPerUnit)),
      lunchpadOrder.transactions || {},
      KaspaNetworkActionsService.KaspaToSompi(String(lunchpad.maxFeeRatePerTransaction)),
      notifyUpdate,
    );
  }

  getRequiredAmountForBatchMint(batchMintEntity: BatchMintEntity): number {
    return KaspaNetworkActionsService.SompiToNumber(
      this.kaspaNetworkActionsService.getRequiredKaspaAmountForBatchMint(
        batchMintEntity.totalMints,
        KaspaNetworkActionsService.KaspaToSompi(String(batchMintEntity.maxPriorityFee)),
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
      KaspaNetworkActionsService.KaspaToSompi(String(batchMintEntity.maxPriorityFee)),
    );

    if (requiredKaspaAmount > walletUtxoData.totalBalance) {
      throw new IncorrectKaspaAmountForBatchMint(walletUtxoData.totalBalance, requiredKaspaAmount);
    }

    if (batchMintEntity.finishedMints == 0) {
      if (walletUtxoData.utxoEntries.length != 1) {
        throw new IncorrectUtxoAmountForBatchMint(walletUtxoData.utxoEntries.length, 1);
      }

      if (
        !(await this.kaspaNetworkActionsService.verifyPaymentTransaction(
          walletUtxoData.utxoEntries[0].outpoint.transactionId,
          batchMintEntity.ownerWallet,
          walletAccount.address,
          requiredKaspaAmount,
        ))
      ) {
        throw new BatchMintUnknownMoneyError(walletUtxoData.totalBalance, batchMintEntity);
      }
    }

    return true;
  }

  async doBatchMint(
    batchMintEntity: BatchMintEntity,
    notifyUpdate: (result: Partial<Krc20TransactionsResult>) => Promise<void>,
  ): Promise<{
    isMintOver: boolean;
    refundTransactionId: string;
  }> {
    const batchMintWallet = await this.kaspaNetworkActionsService.getWalletAccountAtIndex(batchMintEntity.walletSequenceId);

    const finishedTransactionsLength = (batchMintEntity.transactions && batchMintEntity.transactions.length) || 0;
    let isMintOver = false;

    let lastTransactions: Partial<KRC20ActionTransations> =
      batchMintEntity.transactions && finishedTransactionsLength
        ? batchMintEntity.transactions[finishedTransactionsLength - 1]
        : {};

    let timesLeftToRun = batchMintEntity.totalMints - finishedTransactionsLength;

    if (!(!isEmptyString(lastTransactions.commitTransactionId) && isEmptyString(lastTransactions.revealTransactionId))) {
      lastTransactions = {};
      timesLeftToRun++;
    }

    for (let i = 0; i < timesLeftToRun; i++) {
      if (Object.keys(lastTransactions).length == 0) {
        const mintsLeft = await this.kasplexApiService.getTokenRemainingMints(batchMintEntity.ticker);

        console.log('REMAINING MINTS', mintsLeft);

        if (mintsLeft <= MIN_MINTS_FOR_BATCH_MINTS) {
          isMintOver = true;
          break;
        }
      }

      await this.kaspaNetworkActionsService.mintAndNotify(
        batchMintWallet.privateKey,
        batchMintEntity.ticker,
        KaspaNetworkActionsService.KaspaToSompi(String(batchMintEntity.maxPriorityFee)),
        lastTransactions,
        notifyUpdate,
      );

      lastTransactions = {};
    }

    const refundTransaction = await this.kaspaNetworkActionsService.transferAllRemainingKaspa(
      batchMintWallet.privateKey,
      KaspaNetworkActionsService.KaspaToSompi(String(batchMintEntity.maxPriorityFee)),
      batchMintEntity.ownerWallet,
    );

    return { isMintOver, refundTransactionId: refundTransaction.summary.finalTransactionId };
  }
}
