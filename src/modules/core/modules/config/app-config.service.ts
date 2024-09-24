import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {
    console.log('All Environment Variables:', JSON.stringify(process.env));
  }

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
    return this.configService.get('PORT');
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

  get masterWalletKey(): string {
    return this.configService.get('MASTER_WALLET_KEY');
  }

  get encryptionKeys() {
    return {
      KEY_32: this.configService.get('ENCRYPTION_32_CHARS_KEY'),
      KEY_16: this.configService.get('ENCRYPTION_16_CHARS_IV_KEY'),
    };
  }

  get generateMasterSeedPassword(): string {
    return this.configService.get('GENERATE_MASTER_SEED_PASSWORD');
  }
}
