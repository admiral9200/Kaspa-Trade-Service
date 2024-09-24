import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfigModule } from '../core/modules/config/app-config.module';
import { AppConfigService } from '../core/modules/config/app-config.service';
import { MONGO_DATABASE_CONNECTIONS } from './constants';
import { P2pController } from './controllers/p2p.controller';
import { WasmFacade } from './facades/wasm.facade';
import { SellOrder, SellOrderSchema } from './model/schemas/sell-order.schema';
import { TemporaryWallet, TemporaryWalletSchema } from './model/schemas/temporary-wallet.schema';
import { P2pProvider } from './providers/p2p.provider';
import { P2pTemporaryWalletsRepository } from './repositories/p2p-temporary-wallets.repository';
import { SellOrdersBookRepository } from './repositories/sell-orders-book.repository';
import { EncryptionService } from './services/encryption.service';
import { KaspaNetworkActionsService } from './services/kaspa-network/kaspa-network-actions.service';
import { KaspaNetworkTransactionsManagerService } from './services/kaspa-network/kaspa-network-transactions-manager.service';
import { RpcService } from './services/kaspa-network/rpc.service';
import { P2pOrdersService } from './services/p2p-orders.service';

@Module({
  controllers: [P2pController],
  providers: [
    // Providers
    P2pProvider,

    // Facades
    WasmFacade,

    // Services
    P2pOrdersService,
    KaspaNetworkActionsService,
    KaspaNetworkTransactionsManagerService,
    RpcService,
    EncryptionService,

    // Repositories
    SellOrdersBookRepository,
    P2pTemporaryWalletsRepository,
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
        { name: SellOrder.name, schema: SellOrderSchema },
        { name: TemporaryWallet.name, schema: TemporaryWalletSchema },
      ],
      MONGO_DATABASE_CONNECTIONS.P2P,
    ),
  ],
  exports: [],
})
export class BackendModule {}
