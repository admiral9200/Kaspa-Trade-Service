import { Injectable } from '@nestjs/common';
import {
  IPaymentOutput,
  kaspaToSompi,
  Mnemonic,
  PrivateKey,
  XPrv,
} from 'libs/kaspa-dev/kaspa';
import { KaspaNetworkTransactionsManagerService } from './kaspa-network-transactions-manager.service';
import {
  getTransferData,
  KRC20_TRANSACTIONS_AMOUNTS,
} from './classes/KRC20OperationData';
import { AppConfigService } from 'src/modules/core/modules/config/app-config.service';
import { RpcService } from './rpc.service';

@Injectable()
export class KaspaNetworkActionsService {
  constructor(
    private readonly transactionsManagerService: KaspaNetworkTransactionsManagerService,
    private readonly config: AppConfigService,
    private readonly rpcService: RpcService,
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
      console.log('transfering krc20...');

      await this.transferKrc20Token(
        holderWalletPrivateKey,
        krc20tokenTicker,
        buyerAddress,
        krc20TokenAmount,
        0,
      );

      console.log('transfered krc20');

      const commission = this.config.swapCommissionPercentage + 1;
      const commissionInKaspa = (kaspaAmount * BigInt(commission)) / 100n;

      let lastTransactionTotalFee = kaspaToSompi('1');
      const totalWalletAmount = await this.getWalletTotalBalance(
        this.transactionsManagerService.convertPrivateKeyToPublicKey(
          holderWalletPrivateKey,
        ),
      );

      const amountToTransferToCommissionWallet = commissionInKaspa * 2n;
      const amountToTransferToSeller = kaspaAmount - commissionInKaspa;

      let amountToTransferToBuyer =
        totalWalletAmount -
        (amountToTransferToCommissionWallet +
          amountToTransferToSeller +
          lastTransactionTotalFee); // Should be how much left in the wallet

      console.log({
        amountToTransferToCommissionWallet:
          Number(amountToTransferToCommissionWallet) / 1e8,
        amountToTransferToSeller: Number(amountToTransferToSeller) / 1e8,
        amountToTransferToBuyer: Number(amountToTransferToBuyer) / 1e8,
      });

      if (amountToTransferToBuyer < 0) {
        throw new Error('Not enough balance in the wallet');
      }

      console.log('Creating temp transaction...');

      const tempTransaction =
        await this.transactionsManagerService.createTransaction(
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

      lastTransactionTotalFee =
        await this.transactionsManagerService.calculateFeeForTransaction(
          tempTransaction,
        );

      amountToTransferToBuyer =
        totalWalletAmount -
        (amountToTransferToCommissionWallet +
          amountToTransferToSeller +
          lastTransactionTotalFee); // Should be how much left in the wallet

      if (amountToTransferToBuyer < 0) {
        throw new Error('Not enough balance in the wallet');
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
        0n,
        true,
      );
    });
  }

  async transferKaspa(
    privateKey: PrivateKey,
    payments: IPaymentOutput[],
    priorityFee: bigint,
  ) {
    return await this.transactionsManagerService.connectAndDo(async () => {
      return await this.transactionsManagerService.createKaspaTransferTransactionAndDo(
        privateKey,
        payments,
        priorityFee,
      );
    });
  }

  async transferKrc20Token(
    privateKey: PrivateKey,
    ticker: string,
    recipientAdress: string,
    amount: bigint,
    priorityFee: number,
  ) {
    return await this.transactionsManagerService.connectAndDo(async () => {
      const result =
        await this.transactionsManagerService.createKrc20TransactionAndDoReveal(
          privateKey,
          priorityFee,
          getTransferData(ticker, amount, recipientAdress),
          KRC20_TRANSACTIONS_AMOUNTS.TRANSFER,
        );

      return result;
    });
  }

  async createWallet() {
    const mnemonic = Mnemonic.random();
    const seed = mnemonic.toSeed(this.config.walletSeed);
    const xprv = new XPrv(seed);

    const receivePrivateKey = xprv
      .derivePath("m/44'/111111'/0'/0/0")
      .toPrivateKey(); // Derive the private key for the receive address
    const changePrivateKey = xprv
      .derivePath("m/44'/111111'/0'/1/0")
      .toPrivateKey(); // Derive the private key for the change address

    const receivePublicKey = receivePrivateKey.toPublicKey();
    const changePublicKey = changePrivateKey.toPublicKey();

    const receiveAddress = receivePublicKey
      .toAddress(this.rpcService.getNetwork())
      .toString();
    const changeAddress = changePublicKey
      .toAddress(this.rpcService.getNetwork())
      .toString();

    const receivePrivateKeyString = receivePrivateKey.toString();
    const changePrivateKeyString = changePrivateKey.toString();

    return {
      mnemonic: mnemonic.phrase,
      receivePrivateKey: receivePrivateKeyString,
      changePrivateKey: changePrivateKeyString,
      receive: receiveAddress,
      change: changeAddress,
    };
  }

  async getWalletTotalBalance(address: string): Promise<bigint> {
    return await this.transactionsManagerService.connectAndDo(async () => {
      const utxos = await this.rpcService.getRpc().getUtxosByAddresses({
        addresses: [address],
      });

      return utxos.entries.reduce((acc, curr) => acc + curr.amount, 0n);
    });
  }

  async logMyWallets(title) {
    const data = {
      w1: await this.getWalletTotalBalance(
        'kaspatest:qpdzgy8gvav58tgjwlxr7sj8fd6888r8l93tvqnkkwk3mhy8phgd5uq3yrpc2',
      ),
      w2: await this.getWalletTotalBalance(
        'kaspatest:qqvy0kf7yf2dzz0cmsaaf7gdt9nn6dh7ykvztdn9cev5wm0jp6dgv26v7c7mv',
      ),
      w3: await this.getWalletTotalBalance(
        'kaspatest:qqnvk0l36gn47l2mnktq5m67csmm79wlczva4jcen6xnt6q4z430ccs8dzgzn',
      ),
      w4: await this.getWalletTotalBalance(
        'kaspatest:qzaxjq87c3yl8xggv8fl39smmahvl8yusgcrw45equjeu8hfz5wtct9y4n96t',
      ),
    };

    console.log(`--- LOG ${title} - ${new Date().toLocaleTimeString()}`);
    console.log(data);
    return data;
  }
}
