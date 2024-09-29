import { Injectable } from '@nestjs/common';
import { IPaymentOutput, kaspaToSompi, Mnemonic, PrivateKey, PrivateKeyGenerator, XPrv } from 'libs/kaspa/kaspa';
import { KaspaNetworkTransactionsManagerService, MINIMAL_AMOUNT_TO_SEND } from './kaspa-network-transactions-manager.service';
import { getTransferData, KRC20_TRANSACTIONS_AMOUNTS } from './classes/KRC20OperationData';
import { AppConfigService } from 'src/modules/core/modules/config/app-config.service';
import { EncryptionService } from '../encryption.service';
import { WalletAccount } from './interfaces/wallet-account.interface';
import { SwapTransactionsResult } from './interfaces/SwapTransactionsResult.interface';
import { Krc20TransactionsResult } from './interfaces/Krc20TransactionsResult.interface';
import { IncorrectKaspaAmountForSwap } from './errors/IncorrectKaspaAmountForSwap';
import { KaspaApiService } from '../kaspa-api/services/kaspa-api.service';
import { TotalBalanceWithUtxosInterface } from './interfaces/TotalBalanceWithUtxos.interface';

export const AMOUNT_FOR_SWAP_FEES = kaspaToSompi('5');
// MUST BE EQUAL OR ABOVE MINIMAL_AMOUNT_TO_SEND, WHICH IS NOW 0.2 ACCORDING TO WASM LIMITATION
// I SEPERATED THIS BECAUSE THIS IS MORE MONEY RELATED AND THE OTHER IS MORE GETTING DEMO TRANSACTION RELATED
const MIMINAL_COMMITION = kaspaToSompi('1');
const KASPA_TRANSACTION_MASS = 3000;
const KRC20_TRANSACTION_MASS = 3370;

@Injectable()
export class KaspaNetworkActionsService {
  constructor(
    private readonly transactionsManagerService: KaspaNetworkTransactionsManagerService,
    private readonly config: AppConfigService,
    private readonly encryptionService: EncryptionService,
    private readonly kaspaApiService: KaspaApiService,
  ) {}

  async verifyTransactionResultWithKaspaApiAndWalletTotalAmount(
    transactionId: string,
    from: string,
    to: string,
    amount: bigint,
  ): Promise<boolean> {
    const kaspaApiResult = await this.kaspaApiService.verifyPaymentTransaction(transactionId, from, to, Number(amount));
    if (!kaspaApiResult) {
      return false;
    }

    const walletTotalBalance = await this.getWalletTotalBalance(to);

    // Must be == and not >=, Because if there is there extra money it belongs to someone else
    // And it will be sent to the buyer even though it's not his money
    // This is in case of an error
    return walletTotalBalance === amount;
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
        const totalWalletAmountAtStart = await this.getWalletTotalBalance(
          this.transactionsManagerService.convertPrivateKeyToPublicKey(holderWalletPrivateKey),
        );

        if (totalWalletAmountAtStart < AMOUNT_FOR_SWAP_FEES + kaspaAmount) {
          throw new IncorrectKaspaAmountForSwap(totalWalletAmountAtStart, AMOUNT_FOR_SWAP_FEES + kaspaAmount);
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
        let commissionInKaspa = (kaspaAmount * BigInt(commission)) / 100n;

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

  async transferKaspa(privateKey: PrivateKey, payments: IPaymentOutput[], maxPriorityFee: bigint) {
    return await this.transactionsManagerService.connectAndDo(async () => {
      return await this.transactionsManagerService.createKaspaTransferTransactionAndDo(privateKey, payments, maxPriorityFee);
    });
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

  async logMyWallets(title) {
    const data = {
      w1: await this.getWalletTotalBalance('kaspatest:qpdzgy8gvav58tgjwlxr7sj8fd6888r8l93tvqnkkwk3mhy8phgd5uq3yrpc2'),
      w2: await this.getWalletTotalBalance('kaspatest:qqvy0kf7yf2dzz0cmsaaf7gdt9nn6dh7ykvztdn9cev5wm0jp6dgv26v7c7mv'),
      w3: await this.getWalletTotalBalance('kaspatest:qqnvk0l36gn47l2mnktq5m67csmm79wlczva4jcen6xnt6q4z430ccs8dzgzn'),
      w4: await this.getWalletTotalBalance('kaspatest:qzaxjq87c3yl8xggv8fl39smmahvl8yusgcrw45equjeu8hfz5wtct9y4n96t'),
    };

    console.log(`--- LOG ${title} - ${new Date().toLocaleTimeString()}`);
    console.log(data);
    return data;
  }

  static KaspaToSompi(value: string): bigint {
    return kaspaToSompi(value);
  }
}
