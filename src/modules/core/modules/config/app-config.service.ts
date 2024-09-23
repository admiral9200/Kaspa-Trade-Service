import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  get isProduction(): boolean {
    return this.configService.get('nodeEnv') === 'production';
  }

  get getServiceName(): string {
    return this.configService.get('name') || 'default-service';
  }

  get getEnv(): string {
    return this.configService.get('env');
  }

  get getServicePort(): number {
    return this.configService.get('port');
  }

  get getMailTransport(): string {
    return this.configService.get('MAIL_TRANSPORT');
  }

  get p2pDatabaseConnectionUrl(): string {
    return this.configService.get('P2P_DATABASE_CONNECTION_URL');
  }

  get kaspaNetwork(): string {
    return this.configService.get('KASPA_NETWORK');
  }

  get walletSeed(): string {
    return this.configService.get('WALLET_SEED');
  }

  get swapCommissionPercentage(): number {
    return Number(this.configService.get('SWAP_COMMISSION_PERCANTAGE'));
  }

  get commitionWalletAddress(): string {
    return this.configService.get('COMMISSION_WALLET_ADDRESS');
  }

  get transactionFeeTestWalletPrivateKey(): string {
    return this.configService.get('TRANSACTION_FEE_TEST_WALLET_PRIVATE_KEY');
  }
}
