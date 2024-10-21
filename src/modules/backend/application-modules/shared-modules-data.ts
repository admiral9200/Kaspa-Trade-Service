import { P2pProvider } from '../providers/p2p.provider';
import { HttpModule } from '@nestjs/axios';
import { P2pOrdersService } from '../services/p2p-orders.service';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfigService } from '../../core/modules/config/app-config.service';
import { MONGO_DATABASE_CONNECTIONS } from '../constants';
import { AppConfigModule } from '../../core/modules/config/app-config.module';
import { P2pOrderEntity, P2pOrderSchema } from '../model/schemas/p2p-order.schema';
import { SellOrdersBookRepository } from '../repositories/sell-orders-book.repository';
import { KaspaFacade } from '../facades/kaspa.facade';
import { KaspaNetworkActionsService } from '../services/kaspa-network/kaspa-network-actions.service';
import { KaspaNetworkTransactionsManagerService } from '../services/kaspa-network/kaspa-network-transactions-manager.service';
import { RpcService } from '../services/kaspa-network/rpc.service';
import { EncryptionService } from '../services/encryption.service';
import { TemporaryWalletsSequence, TemporaryWalletsSequenceSchema } from '../model/schemas/temporary-wallets-sequence.schema';
import { P2pTemporaryWalletsSequenceRepository } from '../repositories/p2p-temporary-wallets-sequence.repository';
import { TemporaryWalletSequenceService } from '../services/temporary-wallet-sequence.service';
import { P2pOrderHelper } from '../helpers/p2p-order.helper';
import { KaspaApiModule } from '../services/kaspa-api/kaspa-api.module';
import { KasplexApiModule } from '../services/kasplex-api/kasplex-api.module';
import { UtilsHelper } from '../helpers/utils.helper';
import { TelegramNotifierModule } from '../../shared/telegram-notifier/telegram-notifier.module';
import { P2pTelegramNotifierService } from '../services/telegram-bot/p2p-telegram-notifier.service';
import { Provider } from '@nestjs/common/interfaces/modules/provider.interface';
import { WalletGuard } from '../guards/wallet.guard';
import { AdminWalletGuard } from '../guards/adminWallet.guard';
import { AppGlobalLoggerService } from '../../core/modules/logger/app-global-logger.service';
import { KaspaNetworkConnectionManagerService } from '../services/kaspa-network/kaspa-network-connection-manager.service';
import { LunchpadService } from '../services/lunchpad.service';
import { LunchpadProvider } from '../providers/lunchpad.provider';
import { LunchpadRepository } from '../repositories/lunchpad.repository';
import { LunchpadEntity, LunchpadEntitySchema } from '../model/schemas/lunchpad.schema';
import { LunchpadOrder, LunchpadOrderSchema } from '../model/schemas/lunchpad-order.schema';
import { BatchMintProvider } from '../providers/batch-mint.provider';

export const BASE_PROVIDERS: Provider[] = [
  // Providers
  P2pProvider,
  LunchpadProvider,
  BatchMintProvider,

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
  LunchpadService,

  // Helpers
  P2pOrderHelper,
  UtilsHelper,

  // Repositories
  SellOrdersBookRepository,
  P2pTemporaryWalletsSequenceRepository,
  LunchpadRepository,

  // Guards
  WalletGuard,
  AdminWalletGuard,
];

export const BASE_IMPORTS = [
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
      { name: LunchpadEntity.name, schema: LunchpadEntitySchema },
      { name: LunchpadOrder.name, schema: LunchpadOrderSchema },
    ],
    MONGO_DATABASE_CONNECTIONS.P2P,
  ),
  KaspaApiModule,
  KasplexApiModule,
];
