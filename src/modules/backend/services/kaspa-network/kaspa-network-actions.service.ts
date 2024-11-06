import { Injectable } from '@nestjs/common';
import { IPaymentOutput, kaspaToSompi, Mnemonic, PrivateKey, PrivateKeyGenerator, XPrv } from 'libs/kaspa/kaspa';
import { KaspaNetworkTransactionsManagerService, MINIMAL_AMOUNT_TO_SEND } from './kaspa-network-transactions-manager.service';
import {
  getMintData,
  getTransferData,
  KRC20_BASE_TRANSACTION_AMOUNT,
  KRC20_TRANSACTIONS_AMOUNTS,
  KRC20OperationDataInterface,
} from './classes/KRC20OperationData';
import { AppConfigService } from 'src/modules/core/modules/config/app-config.service';
import { EncryptionService } from '../encryption.service';
import { WalletAccount } from './interfaces/wallet-account.interface';
import { SwapTransactionsResult } from './interfaces/SwapTransactionsResult.interface';
import { Krc20TransactionsResult } from './interfaces/Krc20TransactionsResult.interface';
import { IncorrectKaspaAmountForSwap } from './errors/IncorrectKaspaAmountForSwap';
import { KaspaApiService } from '../kaspa-api/services/kaspa-api.service';
import { TotalBalanceWithUtxosInterface } from './interfaces/TotalBalanceWithUtxos.interface';
import { KRC20ActionTransations } from './interfaces/Krc20ActionTransactions.interface';
import { IncorrectKaspaAmountForKrc20Action } from './errors/IncorrectKaspaAmountForKrc20Action';

export const AMOUNT_FOR_SWAP_FEES = kaspaToSompi('5');
// MUST BE EQUAL OR ABOVE MINIMAL_AMOUNT_TO_SEND, WHICH IS NOW 0.2 ACCORDING TO WASM LIMITATION
// I SEPERATED THIS BECAUSE THIS IS MORE MONEY RELATED AND THE OTHER IS MORE GETTING DEMO TRANSACTION RELATED
export const MIMINAL_COMMITION = kaspaToSompi('1');
const KASPA_TRANSACTION_MASS = 3000;
const KRC20_TRANSACTION_MASS = 3370;
const MAX_ESTIMATED_KRC20_TRANSACTION_MASS = 10000n;

@Injectable()
export class KaspaNetworkActionsService {
  constructor(
    private readonly transactionsManagerService: KaspaNetworkTransactionsManagerService,
    private readonly config: AppConfigService,
    private readonly encryptionService: EncryptionService,
    private readonly kaspaApiService: KaspaApiService,
  ) {}

  getBatchMintCommissionInSompi(mintsAmount: number): bigint {
    const mintsComission =
      (BigInt(mintsAmount * this.config.batchMintCommissionPercentage) * KRC20_TRANSACTIONS_AMOUNTS.MINT) / 100n;

    return mintsComission < MIMINAL_COMMITION ? MIMINAL_COMMITION : mintsComission;
  }

  getRequiredKaspaAmountForBatchMint(amountToMint: number, maxPriorityFee: bigint): bigint {
    let maxPriortyFeeWithMintAmount = maxPriorityFee - KRC20_TRANSACTIONS_AMOUNTS.MINT;
    const estimatedKrc20TransactionsMass = MAX_ESTIMATED_KRC20_TRANSACTION_MASS * 2n;

    if (maxPriortyFeeWithMintAmount < 0) {
      maxPriortyFeeWithMintAmount = 0n;
    }

    // EXPLNATION -
    // for every transaction there is commit and reveal
    // reveal always 1 priority fee or more, maxPriortyFeeWithMintAmount is what is above 1
    // estimatedKrc20TransactionsMass - how much mass is every transaction more or less
    const baseAmountForMints =
      BigInt(amountToMint) *
        (maxPriorityFee + maxPriortyFeeWithMintAmount + estimatedKrc20TransactionsMass + KRC20_TRANSACTIONS_AMOUNTS.MINT) +
      KRC20_BASE_TRANSACTION_AMOUNT +
      this.getBatchMintCommissionInSompi(amountToMint);

    // 3 transactions - commit, reveal and kaspa
    const amountForTransactionsTuReturnToTheSeller =
      maxPriorityFee * 3n + estimatedKrc20TransactionsMass + MAX_ESTIMATED_KRC20_TRANSACTION_MASS;

    const requiredAmount = baseAmountForMints + amountForTransactionsTuReturnToTheSeller;

    const requiredAmountCeiled = Math.ceil(KaspaNetworkActionsService.SompiToNumber(requiredAmount));

    return KaspaNetworkActionsService.KaspaToSompi(String(requiredAmountCeiled));
  }

  async getTransactionSenderWallet(transactionId: string, receiverWallet: string, amount: bigint): Promise<string> {
    return await this.kaspaApiService.getTransactionSender(transactionId, receiverWallet, amount);
  }

  async verifyPaymentTransaction(transactionId: string, from: string, to: string, amount: bigint): Promise<boolean> {
    return await this.kaspaApiService.verifyPaymentTransaction(transactionId, from, to, amount);
  }

  async verifyTransactionResultWithKaspaApiAndWalletTotalAmount(
    transactionId: string,
    from: string,
    to: string,
    amount: bigint,
  ): Promise<boolean> {
    const kaspaApiResult = await this.verifyPaymentTransaction(transactionId, from, to, amount);
    if (!kaspaApiResult) {
      return false;
    }

    const walletTotalBalance = await this.getWalletTotalBalance(to);

    // Must be == and not >=, Because if there is there extra money it belongs to someone else
    // And it will be sent to the buyer even though it's not his money
    // This is in case of an error
    return walletTotalBalance === amount;
  }

  async isValidKaspaAmountForSwap(
    walletAddress: string,
    swapAmount: bigint,
  ): Promise<{ isValid: boolean; requiredAmount: bigint; currentAmount: bigint }> {
    const totalWalletAmountAtStart = await this.getWalletTotalBalance(walletAddress);

    const requiredAmount = swapAmount + AMOUNT_FOR_SWAP_FEES;

    return {
      isValid: totalWalletAmountAtStart === requiredAmount,
      requiredAmount,
      currentAmount: totalWalletAmountAtStart,
    };
  }

  /**
   * Doing sell swp
   * @param buyerAddress - the address of the wallet that will receive the Krc20Token
   * @param sellerAddress - the address of the wallet that will receive the payment in kaspt
   * @param krc20tokenTicker
   * @param krc20TokenAmount - In sompi
   * @param kaspaAmount - The price that the user pays, in sompi
   * @param priorityFee
   */
  async doSellSwap(
    holderWalletPrivateKey: PrivateKey,
    buyerAddress: string,
    sellerAddress: string,
    krc20tokenTicker: string,
    krc20TokenAmount: bigint,
    kaspaAmount: bigint,
    alreadyFinishedTransactions: Partial<SwapTransactionsResult>,
    notifyUpdate: (result: Partial<SwapTransactionsResult>) => Promise<void>,
  ): Promise<SwapTransactionsResult> {
    const resultTransactions = { ...alreadyFinishedTransactions };

    const maxPriorityFee = BigInt(Math.floor(Number(AMOUNT_FOR_SWAP_FEES) / 5));

    const krc20OperationData = getTransferData(krc20tokenTicker, krc20TokenAmount, buyerAddress);

    return await this.transactionsManagerService.connectAndDo<SwapTransactionsResult>(async () => {
      if (!resultTransactions.commitTransactionId) {
        const isWalletHasValidAmount = await this.isValidKaspaAmountForSwap(
          this.transactionsManagerService.convertPrivateKeyToPublicKey(holderWalletPrivateKey),
          kaspaAmount,
        );

        if (!isWalletHasValidAmount.isValid) {
          throw new IncorrectKaspaAmountForSwap(isWalletHasValidAmount.currentAmount, isWalletHasValidAmount.requiredAmount);
        }

        const commitTransaction = await this.transactionsManagerService.doKrc20CommitTransaction(
          holderWalletPrivateKey,
          krc20OperationData,
          maxPriorityFee,
        );

        resultTransactions.commitTransactionId = commitTransaction.summary.finalTransactionId;
        await notifyUpdate(resultTransactions);
      }

      if (!resultTransactions.revealTransactionId) {
        const revealTransaction = await this.transactionsManagerService.doKrc20RevealTransaction(
          holderWalletPrivateKey,
          krc20OperationData,
          KRC20_TRANSACTIONS_AMOUNTS.TRANSFER,
          maxPriorityFee,
        );

        resultTransactions.revealTransactionId = revealTransaction.summary.finalTransactionId;
        await notifyUpdate(resultTransactions);
      }

      if (!resultTransactions.sellerTransactionId) {
        const commission = this.config.swapCommissionPercentage;
        let commissionInKaspa = BigInt(Math.floor((Number(kaspaAmount) * Number(commission)) / 100));

        if (commissionInKaspa < MIMINAL_COMMITION) {
          commissionInKaspa = MIMINAL_COMMITION;
        }

        const amountToTransferToSeller = kaspaAmount - commissionInKaspa;

        const sellerTransaction = await this.transactionsManagerService.createKaspaTransferTransactionAndDo(
          holderWalletPrivateKey,
          [
            {
              address: sellerAddress,
              amount: amountToTransferToSeller,
            },
            {
              address: this.config.commitionWalletAddress,
              amount: commissionInKaspa,
            },
          ],
          maxPriorityFee,
          false,
        );

        resultTransactions.sellerTransactionId = sellerTransaction.summary.finalTransactionId;
        await notifyUpdate(resultTransactions);
      }

      if (!resultTransactions.buyerTransactionId) {
        const buyerTransaction = await this.transactionsManagerService.createKaspaTransferTransactionAndDo(
          holderWalletPrivateKey,
          [
            {
              address: buyerAddress,
              amount: MINIMAL_AMOUNT_TO_SEND,
            },
          ],
          maxPriorityFee,
          true,
        );

        resultTransactions.buyerTransactionId = buyerTransaction.summary.finalTransactionId;
        await notifyUpdate(resultTransactions);
      }

      return resultTransactions as SwapTransactionsResult;
    });
  }

  async cancelSellSwap(
    holderWalletPrivateKey: PrivateKey,
    sellerAddress: string,
    krc20tokenTicker: string,
    krc20TokenAmount: bigint,
    alreadyFinishedTransactions: Partial<SwapTransactionsResult>,
    notifyUpdate: (result: Partial<SwapTransactionsResult>) => Promise<void>,
  ): Promise<SwapTransactionsResult> {
    const resultTransactions = { ...alreadyFinishedTransactions };

    const maxPriorityFee = BigInt(Math.floor(Number(AMOUNT_FOR_SWAP_FEES) / 5));

    const krc20OperationData = getTransferData(krc20tokenTicker, krc20TokenAmount, sellerAddress);

    return await this.transactionsManagerService.connectAndDo<SwapTransactionsResult>(async () => {
      if (!resultTransactions.commitTransactionId) {
        const totalWalletAmountAtStart = await this.getWalletTotalBalance(
          this.transactionsManagerService.convertPrivateKeyToPublicKey(holderWalletPrivateKey),
        );

        if (totalWalletAmountAtStart != AMOUNT_FOR_SWAP_FEES) {
          throw new IncorrectKaspaAmountForSwap(totalWalletAmountAtStart, AMOUNT_FOR_SWAP_FEES);
        }

        const commitTransaction = await this.transactionsManagerService.doKrc20CommitTransaction(
          holderWalletPrivateKey,
          krc20OperationData,
          maxPriorityFee,
        );

        resultTransactions.commitTransactionId = commitTransaction.summary.finalTransactionId;
        await notifyUpdate(resultTransactions);
      }

      if (!resultTransactions.revealTransactionId) {
        const revealTransaction = await this.transactionsManagerService.doKrc20RevealTransaction(
          holderWalletPrivateKey,
          krc20OperationData,
          KRC20_TRANSACTIONS_AMOUNTS.TRANSFER,
          maxPriorityFee,
        );

        resultTransactions.revealTransactionId = revealTransaction.summary.finalTransactionId;
        await notifyUpdate(resultTransactions);
      }

      if (!resultTransactions.sellerTransactionId) {
        const buyerTransaction = await this.transactionsManagerService.createKaspaTransferTransactionAndDo(
          holderWalletPrivateKey,
          [
            {
              address: sellerAddress,
              amount: MINIMAL_AMOUNT_TO_SEND,
            },
          ],
          maxPriorityFee,
          true,
        );

        resultTransactions.buyerTransactionId = buyerTransaction.summary.finalTransactionId;
        await notifyUpdate(resultTransactions);
      }

      return resultTransactions as SwapTransactionsResult;
    });
  }

  private async doKrc20TransactionAndNotifyWithUtxoProcessor(
    holderWalletPrivateKey: PrivateKey,
    operationData: KRC20OperationDataInterface,
    operationCost: bigint,
    maxPriorityFee: bigint,
    alreadyFinishedTransactions: Partial<KRC20ActionTransations>,
    notifyUpdate: (result: Partial<KRC20ActionTransations>) => Promise<void>,
  ) {
    const resultTransactions = { ...alreadyFinishedTransactions };

    return await this.transactionsManagerService.connectAndDo<KRC20ActionTransations>(async () => {
      if (!resultTransactions.commitTransactionId) {
        const totalWalletAmountAtStart = await this.getWalletTotalBalance(
          this.transactionsManagerService.convertPrivateKeyToPublicKey(holderWalletPrivateKey),
        );

        if (totalWalletAmountAtStart < operationCost || totalWalletAmountAtStart < KRC20_BASE_TRANSACTION_AMOUNT) {
          throw new IncorrectKaspaAmountForKrc20Action(totalWalletAmountAtStart, operationCost);
        }

        const baseTransactionAmount =
          KRC20_BASE_TRANSACTION_AMOUNT > operationCost ? KRC20_BASE_TRANSACTION_AMOUNT : operationCost;

        await this.transactionsManagerService.doKrc20CommitTransactionWithUtxoProcessor(
          holderWalletPrivateKey,
          operationData,
          maxPriorityFee,
          baseTransactionAmount,
          async (transactionId) => {
            resultTransactions.commitTransactionId = transactionId;
            await notifyUpdate(resultTransactions);
          },
        );
      }

      if (!resultTransactions.revealTransactionId) {
        await this.transactionsManagerService.doKrc20RevealTransactionWithUtxoProcessor(
          holderWalletPrivateKey,
          operationData,
          operationCost,
          maxPriorityFee,
          async (transactionId) => {
            resultTransactions.revealTransactionId = transactionId;
            await notifyUpdate(resultTransactions);
          },
        );
      }

      return resultTransactions as KRC20ActionTransations;
    });
  }

  async mintAndNotify(
    holderWalletPrivateKey: PrivateKey,
    krc20tokenTicker: string,
    maxPriorityFee: bigint,
    alreadyFinishedTransactions: Partial<KRC20ActionTransations>,
    notifyUpdate: (result: Partial<KRC20ActionTransations>) => Promise<void>,
  ) {
    const krc20OperationData = getMintData(krc20tokenTicker);

    return await this.doKrc20TransactionAndNotifyWithUtxoProcessor(
      holderWalletPrivateKey,
      krc20OperationData,
      KRC20_TRANSACTIONS_AMOUNTS.MINT,
      maxPriorityFee,
      alreadyFinishedTransactions,
      notifyUpdate,
    );
  }

  async transferKrc20TokenAndNotify(
    holderWalletPrivateKey: PrivateKey,
    sellerAddress: string,
    krc20tokenTicker: string,
    krc20TokenAmount: bigint,
    alreadyFinishedTransactions: Partial<KRC20ActionTransations>,
    maxPriorityFee: bigint,
    notifyUpdate: (result: Partial<KRC20ActionTransations>) => Promise<void>,
  ): Promise<KRC20ActionTransations> {
    const krc20OperationData = getTransferData(krc20tokenTicker, krc20TokenAmount, sellerAddress);

    return await this.doKrc20TransactionAndNotifyWithUtxoProcessor(
      holderWalletPrivateKey,
      krc20OperationData,
      KRC20_TRANSACTIONS_AMOUNTS.TRANSFER,
      maxPriorityFee,
      alreadyFinishedTransactions,
      notifyUpdate,
    );
  }

  async transferKaspa(privateKey: PrivateKey, payments: IPaymentOutput[], maxPriorityFee: bigint) {
    return await this.transactionsManagerService.connectAndDo(async () => {
      return await this.transactionsManagerService.createKaspaTransferTransactionAndDo(privateKey, payments, maxPriorityFee);
    });
  }

  async transferAllRemainingKaspa(
    privateKey: PrivateKey,
    maxPriorityFee: bigint,
    targetWallet: string,
    notifyUpdateKasRefundTransaction: (result: string) => Promise<void> = null,
    commission: bigint = 0n,
  ) {
    const payments = [
      {
        address: targetWallet,
        amount: MINIMAL_AMOUNT_TO_SEND,
      },
    ];

    if (commission && commission > 0n) {
      payments.push({
        address: this.config.commitionWalletAddress,
        amount: commission,
      });
    }

    return await this.transactionsManagerService.doKaspaTransferTransactionWithUtxoProcessor(
      privateKey,
      payments,
      maxPriorityFee,
      true,
      notifyUpdateKasRefundTransaction,
    );
  }

  async transferKrc20Token(
    privateKey: PrivateKey,
    ticker: string,
    recipientAdress: string,
    amount: bigint,
    maxPriorityFee: bigint = 0n,
  ): Promise<Krc20TransactionsResult> {
    return await this.transactionsManagerService.connectAndDo(async () => {
      const result = await this.transactionsManagerService.createKrc20TransactionAndDoReveal(
        privateKey,
        getTransferData(ticker, amount, recipientAdress),
        KRC20_TRANSACTIONS_AMOUNTS.TRANSFER,
        maxPriorityFee,
      );

      return result;
    });
  }

  async generateMasterWallet() {
    const mnemonic = Mnemonic.random();
    const seed = mnemonic.toSeed(this.config.walletSeed);
    const xprv = new XPrv(seed);
    const masterWalletKey = xprv.intoString('kprv');

    const encryptedKey = await this.encryptionService.encrypt(masterWalletKey);

    return {
      encryptedXPrv: encryptedKey,
      mnemonic,
      seed,
    };
  }

  async getWalletAccountAtIndex(index: number, xprvString: string = null): Promise<WalletAccount> {
    const xprv = XPrv.fromXPrv(xprvString || (await this.encryptionService.decrypt(this.config.masterWalletKey)));

    const account = new PrivateKeyGenerator(xprv, false, 0n);

    const privateKey = account.receiveKey(index);

    return {
      privateKey,
      address: this.transactionsManagerService.convertPrivateKeyToPublicKey(privateKey),
    };
  }

  async getWalletTotalBalance(address: string): Promise<bigint> {
    return await this.transactionsManagerService.connectAndDo(async () => {
      return this.transactionsManagerService.getWalletTotalBalance(address);
    });
  }

  async getWalletTotalBalanceAndUtxos(address: string): Promise<TotalBalanceWithUtxosInterface> {
    return await this.transactionsManagerService.connectAndDo(async () => {
      return this.transactionsManagerService.getWalletTotalBalanceAndUtxos(address);
    });
  }

  async getCurrentFeeRate() {
    return await this.transactionsManagerService.connectAndDo(async () => {
      const estimatedFeeRate = await this.transactionsManagerService.getEstimatedPriorityFeeRate();
      return {
        kaspa: estimatedFeeRate * KASPA_TRANSACTION_MASS,
        krc20: estimatedFeeRate * KRC20_TRANSACTION_MASS,
        estimatedFeeRate: estimatedFeeRate,
      };
    });
  }

  static KaspaToSompi(value: string): bigint {
    return kaspaToSompi(value);
  }

  static SompiToNumber(value: bigint): number {
    return Number(value) / 1e8;
  }

  async veryfySignedMessageAndGetWalletAddress(message: string, signature: string, publicKey: string): Promise<string | null> {
    return await this.transactionsManagerService.veryfySignedMessageAndGetWalletAddress(message, signature, publicKey);
  }
}
