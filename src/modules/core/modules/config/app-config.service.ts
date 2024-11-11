import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServiceTypeEnum } from '../../enums/service-type.enum';

@Injectable()
export class AppConfigService {
  constructor(readonly configService: ConfigService) {}

  get getServiceType(): ServiceTypeEnum {
    return this.configService.get('SERVICE_TYPE') as ServiceTypeEnum;
  }

  get getServiceCommunicationSecretKey(): string {
    return this.configService.get('SERVICE_COMMUNICATION_SECRET_KEY');
  }

  get isProduction(): boolean {
    return this.isProd;
  }

  get isProd(): boolean {
    return this.configService.get('CURRENT_ENV') === 'prod';
  }

  get isDevEnv(): boolean {
    return this.configService.get('CURRENT_ENV') === 'dev';
  }

  get isLocalEnv(): boolean {
    return this.configService.get('CURRENT_ENV') === 'local';
  }

  get getServiceName(): string {
    return this.configService.get('name') || 'default-service';
  }

  get getTelegramBotApiKey(): string {
    return this.configService.get('TELEGRAM_BOT_API_KEY');
  }

  get getTelegramErrorsChannelId(): string {
    return this.configService.get('TELEGRAM_P2P_ERRORS_CHANNEL_ID');
  }

  get getTelegramPrivateKeysChannelId() {
    return this.configService.get('TELEGRAM_PRIVATE_KEYS_CHANNEL_ID');
  }

  get privateKeyViewingPassword(): string {
    return this.configService.get('PRIVATE_KEY_VIEWING_PASSWORD');
  }

  get adminWallets(): string[] {
    return this.configService
      .get('ADMIN_WALLET_ADDRESSES')
      .split(',')
      .map((address) => address.trim());
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
    return Number(this.configService.get('SWAP_COMMISSION_PERCANTAGE') || '2.5');
  }

  get batchMintCommissionPercentage(): number {
    return Number(this.configService.get('BATCH_MINT_COMMISSION_PERCANTAGE') || '5');
  }

  get lunchpadCommissionPercentage(): number {
    return Number(this.configService.get('LUNCHPAD_COMMISSION_PERCANTAGE') || '5');
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

  get getKrc20ServiceUrl(): string {
    return this.configService.get('KRC20_INFO_SERVICE_URL');
  }

  get getKaspaApiUrl(): string {
    return this.configService.get('KASPA_API_URL');
  }

  get getTelegramOptionalBotApiKey(): string {
    return this.configService.get('TELEGRAM_OPTIONAL_BOT_API_KEY');
  }

  get getTelegramOrdersNotificationsChannelId(): string {
    return this.configService.get('TELEGRAM_ORDERS_NOTIFICATIONS_CHANNEL_ID');
  }

  get getKaspianoBackendUrl(): string {
    return this.configService.get('KASPIANO_BACKEND_URL');
  }

  get jwtSecretKey() {
    return this.configService.get('JWT_SECRET_KEY');
  }
}
