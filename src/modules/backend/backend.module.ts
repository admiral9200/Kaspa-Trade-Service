import { Module, OnModuleInit } from '@nestjs/common';
import { P2pController } from './controllers/p2p.controller';
import { P2pProvider } from './providers/p2p.provider';
import { HttpModule } from '@nestjs/axios';
import { P2pOrdersService } from './services/p2p-orders.service';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfigService } from '../core/modules/config/app-config.service';
import { MONGO_DATABASE_CONNECTIONS } from './constants';
import { AppConfigModule } from '../core/modules/config/app-config.module';
import { P2pOrderEntity, P2pOrderSchema } from './model/schemas/p2p-order.schema';
import { SellOrdersBookRepository } from './repositories/sell-orders-book.repository';
import { KaspaFacade } from './facades/kaspa.facade';
import { KaspaNetworkActionsService } from './services/kaspa-network/kaspa-network-actions.service';
import { KaspaNetworkTransactionsManagerService } from './services/kaspa-network/kaspa-network-transactions-manager.service';
import { RpcService } from './services/kaspa-network/rpc.service';
import { EncryptionService } from './services/encryption.service';
import { TemporaryWalletsSequence, TemporaryWalletsSequenceSchema } from './model/schemas/temporary-wallets-sequence.schema';
import { P2pTemporaryWalletsSequenceRepository } from './repositories/p2p-temporary-wallets-sequence.repository';
import { TemporaryWalletSequenceService } from './services/temporary-wallet-sequence.service';
import { P2pOrderHelper } from './helpers/p2p-order.helper';
import { KaspaApiModule } from './services/kaspa-api/kaspa-api.module';
import { KasplexApiModule } from './services/kasplex-api/kasplex-api.module';
import { UtilsHelper } from './helpers/utils.helper';
import { ScheduleModule } from '@nestjs/schedule';
import { TelegramNotifierModule } from '../shared/telegram-notifier/telegram-notifier.module';
import { P2pTelegramNotifierService } from './services/telegram-bot/p2p-telegram-notifier.service';
import { Provider } from '@nestjs/common/interfaces/modules/provider.interface';
import { OrdersManagementProvider } from './providers/orders-management.provider';
import { OrdersManagementController } from './controllers/orders-management.controller';
import { WalletGuard } from './guards/wallet.guard';
import { AdminWalletGuard } from './guards/adminWallet.guard';
import { AppGlobalLoggerService } from '../core/modules/logger/app-global-logger.service';
import { KaspaNetworkConnectionManagerService } from './services/kaspa-network/kaspa-network-connection-manager.service';

export const BASE_PROVIDERS: Provider[] = [
  // Providers
  P2pProvider,

  // Facades
  KaspaFacade,

  // Services
  P2pOrdersService,
  KaspaNetworkActionsService,
  KaspaNetworkTransactionsManagerService,
  KaspaNetworkConnectionManagerService,
  TemporaryWalletSequenceService,
  RpcService,
  EncryptionService,
  P2pTelegramNotifierService,
  AppGlobalLoggerService,

  // Helpers
  P2pOrderHelper,
  UtilsHelper,

  // Repositories
  SellOrdersBookRepository,
  P2pTemporaryWalletsSequenceRepository,

  // Guards
  WalletGuard,
  AdminWalletGuard,
];
@Module({
  controllers: [P2pController, OrdersManagementController],
  providers: [...BASE_PROVIDERS, OrdersManagementProvider],
  imports: [
    TelegramNotifierModule,
    HttpModule,
    MongooseModule.forRootAsync({
      imports: [AppConfigModule],
      useFactory: (appConfigService: AppConfigService) => ({
        uri: appConfigService.p2pDatabaseConnectionUrl,
      }),
      inject: [AppConfigService],
      connectionName: MONGO_DATABASE_CONNECTIONS.P2P,
    }),

    MongooseModule.forFeature(
      [
        { name: P2pOrderEntity.name, schema: P2pOrderSchema },
        { name: TemporaryWalletsSequence.name, schema: TemporaryWalletsSequenceSchema },
      ],
      MONGO_DATABASE_CONNECTIONS.P2P,
    ),
    KaspaApiModule,
    KasplexApiModule,
    ScheduleModule.forRoot(),
  ],
  exports: [],
})
export class BackendModule implements OnModuleInit {
  constructor(private readonly temporaryWalletsSequenceRepository: P2pTemporaryWalletsSequenceRepository) {}

  async onModuleInit() {
    await this.temporaryWalletsSequenceRepository.createSequenceIfNotExists();
  }
}
