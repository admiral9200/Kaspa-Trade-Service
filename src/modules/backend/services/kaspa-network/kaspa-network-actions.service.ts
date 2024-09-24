import { Injectable } from '@nestjs/common';
import { IPaymentOutput, kaspaToSompi, Mnemonic, PrivateKey, PrivateKeyGenerator, XPrv } from 'libs/kaspa-dev/kaspa';
import { KaspaNetworkTransactionsManagerService } from './kaspa-network-transactions-manager.service';
import { getTransferData, KRC20_TRANSACTIONS_AMOUNTS } from './classes/KRC20OperationData';
import { AppConfigService } from 'src/modules/core/modules/config/app-config.service';
import { RpcService } from './rpc.service';
import { EncryptionService } from '../encryption.service';
import { NotEnoughBalanceError } from './errors/NotEnoughBalance';
import { PriorityFeeTooHighError } from './errors/PriorityFeeTooHighError';
import { WalletAccount } from './interfaces/wallet-account.interface';

const AMOUNT_FOR_TESTING_FEE = 5;
@Injectable()
export class KaspaNetworkActionsService {
  constructor(
    private readonly transactionsManagerService: KaspaNetworkTransactionsManagerService,
    private readonly config: AppConfigService,
    private readonly rpcService: RpcService,
    private readonly encryptionService: EncryptionService,
  ) {}

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
  ) {
    return await this.transactionsManagerService.connectAndDo(async () => {
      const totalWalletAmountAtStart = await this.getWalletTotalBalance(
        this.transactionsManagerService.convertPrivateKeyToPublicKey(holderWalletPrivateKey),
      );

      const maxPriorityFee = (totalWalletAmountAtStart - kaspaAmount) / 10n;
      console.log('transfering krc20...');

      await this.transferKrc20Token(holderWalletPrivateKey, krc20tokenTicker, buyerAddress, krc20TokenAmount, maxPriorityFee);

      console.log('transfered krc20');

      const commission = this.config.swapCommissionPercentage + 1;
      const commissionInKaspa = (kaspaAmount * BigInt(commission)) / 100n;

      const totalWalletAmount = await this.getWalletTotalBalance(
        this.transactionsManagerService.convertPrivateKeyToPublicKey(holderWalletPrivateKey),
      );

      const amountToTransferToCommissionWallet = commissionInKaspa * 2n;
      const amountToTransferToSeller = kaspaAmount - commissionInKaspa;

      let amountToTransferToBuyer =
        totalWalletAmount - (amountToTransferToCommissionWallet + amountToTransferToSeller + kaspaToSompi('1'));

      if (amountToTransferToBuyer < 0) {
        throw new NotEnoughBalanceError();
      }

      console.log('Creating temp transaction...');

      const tempTransaction = await this.transactionsManagerService.createTransaction(
        holderWalletPrivateKey,
        [
          {
            address: this.config.commitionWalletAddress,
            amount: amountToTransferToCommissionWallet,
          },
          {
            address: sellerAddress,
            amount: amountToTransferToSeller,
          },
          {
            address: buyerAddress,
            amount: amountToTransferToBuyer,
          },
        ],
        0n,
      );

      const lastTransactionFees = await this.transactionsManagerService.getTransactionFees(tempTransaction);

      amountToTransferToBuyer =
        totalWalletAmount - (amountToTransferToCommissionWallet + amountToTransferToSeller + lastTransactionFees.maxFee); // Should be how much left in the wallet

      console.log({
        amountToTransferToCommissionWallet: Number(amountToTransferToCommissionWallet) / 1e8,
        amountToTransferToSeller: Number(amountToTransferToSeller) / 1e8,
        amountToTransferToBuyer: Number(amountToTransferToBuyer) / 1e8,
      });

      if (amountToTransferToBuyer < 0) {
        throw new NotEnoughBalanceError();
      }
      console.log('transfering all kaspa...');

      return await this.transactionsManagerService.createKaspaTransferTransactionAndDo(
        holderWalletPrivateKey,
        [
          {
            address: this.config.commitionWalletAddress,
            amount: amountToTransferToCommissionWallet,
          },
          {
            address: sellerAddress,
            amount: amountToTransferToSeller,
          },
          {
            address: buyerAddress,
            amount: amountToTransferToBuyer,
          },
        ],
        lastTransactionFees.priorityFee,
        true,
      );
    });
  }

  async transferKaspa(privateKey: PrivateKey, payments: IPaymentOutput[], maxPriorityFee: bigint) {
    return await this.transactionsManagerService.connectAndDo(async () => {
      return await this.transactionsManagerService.createKaspaTransferTransactionAndDo(privateKey, payments, maxPriorityFee);
    });
  }

  async transferAllKaspaInWallet(sourceWalletprivateKey: PrivateKey, targetAddress: string) {
    return await this.transactionsManagerService.connectAndDo(async () => {
      const totalWalletAmount = await this.getWalletTotalBalance(
        this.transactionsManagerService.convertPrivateKeyToPublicKey(sourceWalletprivateKey),
      );

      if (totalWalletAmount <= kaspaToSompi('0.2')) {
        throw new NotEnoughBalanceError();
      }

      const tempTransaction = await this.transactionsManagerService.createTransaction(
        sourceWalletprivateKey,
        [
          {
            address: this.config.commitionWalletAddress,
            amount: totalWalletAmount - kaspaToSompi('0.2'),
          },
        ],
        0n,
      );

      const transactionsFees = await this.transactionsManagerService.getTransactionFees(tempTransaction);

      const amountToTransfer = totalWalletAmount - transactionsFees.maxFee;

      if (amountToTransfer <= 0) {
        throw new PriorityFeeTooHighError();
      }

      return await this.transactionsManagerService.createKaspaTransferTransactionAndDo(
        sourceWalletprivateKey,
        [
          {
            address: targetAddress,
            amount: totalWalletAmount - transactionsFees.maxFee,
          },
        ],
        transactionsFees.priorityFee,
        true,
      );
    });
  }

  async transferKrc20Token(
    privateKey: PrivateKey,
    ticker: string,
    recipientAdress: string,
    amount: bigint,
    maxPriorityFee: bigint = 0n,
  ) {
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

    console.log('xprv');
    console.log('enc', encryptedKey);
    console.log('dec', await this.encryptionService.decrypt(encryptedKey));

    return {
      encryptedXPrv: encryptedKey,
      walletForFeeCalc: (await this.getWalletAccountAtIndex(0, masterWalletKey)).address,
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

  async getCurrentFeeRate() {
    return await this.transactionsManagerService.connectAndDo(async () => {
      const transaction = await this.transactionsManagerService.createTransaction(
        (await this.getWalletAccountAtIndex(0)).privateKey,
        [
          {
            address: this.config.commitionWalletAddress,
            amount: kaspaToSompi(String(AMOUNT_FOR_TESTING_FEE)),
          },
        ],
      );

      const feeResults = await this.transactionsManagerService.getTransactionFees(transaction);

      return feeResults.maxFee;
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
