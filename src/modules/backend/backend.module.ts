import { Module, OnModuleInit } from '@nestjs/common';
import { P2pController } from './controllers/p2p.controller';
import { P2pProvider } from './providers/p2p.provider';
import { HttpModule } from '@nestjs/axios';
import { P2pOrdersService } from './services/p2p-orders.service';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfigService } from '../core/modules/config/app-config.service';
import { MONGO_DATABASE_CONNECTIONS } from './constants';
import { AppConfigModule } from '../core/modules/config/app-config.module';
import { P2pOrder, P2pOrderSchema } from './model/schemas/p2p-order.schema';
import { SellOrdersBookRepository } from './repositories/sell-orders-book.repository';
import { KaspaFacade } from './facades/kaspa.facade';
import { KaspaNetworkActionsService } from './services/kaspa-network/kaspa-network-actions.service';
import { KaspaNetworkTransactionsManagerService } from './services/kaspa-network/kaspa-network-transactions-manager.service';
import { RpcService } from './services/kaspa-network/rpc.service';
import { EncryptionService } from './services/encryption.service';
import { TemporaryWallet, TemporaryWalletSchema } from './model/schemas/temporary-wallet.schema';
import { P2pTemporaryWalletsRepository } from './repositories/p2p-temporary-wallets.repository';
import { TemporaryWalletsSequence, TemporaryWalletsSequenceSchema } from './model/schemas/temporary-wallets-sequence.schema';
import { P2pTemporaryWalletsSequenceRepository } from './repositories/p2p-temporary-wallets-sequence.repository';
import { TemporaryWalletService } from './services/temporary-wallet.service';
import { P2pOrderHelper } from './helpers/p2p-order.helper';

@Module({
  controllers: [P2pController],
  providers: [
    // Providers
    P2pProvider,

    // Facades
    KaspaFacade,

    // Services
    P2pOrdersService,
    KaspaNetworkActionsService,
    KaspaNetworkTransactionsManagerService,
    TemporaryWalletService,
    RpcService,
    EncryptionService,

    // Helpers
    P2pOrderHelper,

    // Repositories
    SellOrdersBookRepository,
    P2pTemporaryWalletsRepository,
    P2pTemporaryWalletsSequenceRepository,
  ],
  imports: [
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
        { name: P2pOrder.name, schema: P2pOrderSchema },
        { name: TemporaryWallet.name, schema: TemporaryWalletSchema },
        { name: TemporaryWalletsSequence.name, schema: TemporaryWalletsSequenceSchema },
      ],
      MONGO_DATABASE_CONNECTIONS.P2P,
    ),
  ],
  exports: [],
})
export class BackendModule implements OnModuleInit {
  constructor(private readonly temporaryWalletsSequenceRepository: P2pTemporaryWalletsSequenceRepository) {}

  async onModuleInit() {
    await this.temporaryWalletsSequenceRepository.createSequenceIfNotExists();
  }
}
