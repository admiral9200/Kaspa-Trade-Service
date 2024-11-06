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
import { Provider } from '@nestjs/common/interfaces/modules/provider.interface';
import { AppGlobalLoggerService } from '../../core/modules/logger/app-global-logger.service';
import { KaspaNetworkConnectionManagerService } from '../services/kaspa-network/kaspa-network-connection-manager.service';
import { LunchpadService } from '../services/lunchpad.service';
import { LunchpadProvider } from '../providers/lunchpad.provider';
import { LunchpadRepository } from '../repositories/lunchpad.repository';
import { LunchpadEntity, LunchpadEntitySchema } from '../model/schemas/lunchpad.schema';
import { LunchpadOrder, LunchpadOrderSchema } from '../model/schemas/lunchpad-order.schema';
import { BatchMintProvider } from '../providers/batch-mint.provider';
import { BatchMintService } from '../services/batch-mint.service';
import { BatchMintRepository } from '../repositories/batch-mint.repository';
import { BatchMintEntity, BatchMintEntitySchema } from '../model/schemas/batch-mint.schema';
import { KaspianoBackendApiModule } from '../services/kaspiano-backend-api/kaspiano-backend-api.module';
import { UserRoleService } from '../services/user-role.service';
import { PodJobProvider } from '../providers/pod-job-provider';

export const BASE_PROVIDERS: Provider[] = [
  // Providers
  P2pProvider,
  LunchpadProvider,
  BatchMintProvider,
  PodJobProvider,

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
  AppGlobalLoggerService,
  LunchpadService,
  BatchMintService,
  UserRoleService,

  // Helpers
  P2pOrderHelper,
  UtilsHelper,

  // Repositories
  SellOrdersBookRepository,
  P2pTemporaryWalletsSequenceRepository,
  LunchpadRepository,
  BatchMintRepository,
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
      { name: BatchMintEntity.name, schema: BatchMintEntitySchema },
    ],
    MONGO_DATABASE_CONNECTIONS.P2P,
  ),
  KaspaApiModule,
  KasplexApiModule,
  KaspianoBackendApiModule,
];
