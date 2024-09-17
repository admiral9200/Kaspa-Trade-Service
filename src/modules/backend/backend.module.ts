import { Module } from '@nestjs/common';
import { P2pController } from './controllers/p2p.controller';
import { P2pProvider } from './providers/p2p.provider';
import { HttpModule } from '@nestjs/axios';
import { P2pOrdersService } from './services/p2p-orders.service';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfigService } from '../core/modules/config/app-config.service';
import { MONGO_DATABASE_CONNECTIONS } from './constants';
import { AppConfigModule } from '../core/modules/config/app-config.module';
import { SellOrder, SellOrderSchema } from './model/schemas/sell-order.schema';
import { SellOrdersBookRepository } from './repositories/sell-orders-book.repository';
import { WasmFacade } from './facades/wasm.facade';
import { Krc20ActionsService } from './services/krc20/krc20-actions.service';
import { Krc20TransactionsService } from './services/krc20/krc20-transactions.service';
import { RpcService } from './services/krc20/rpc.service';

@Module({
  controllers: [P2pController],
  providers: [
    // Providers
    P2pProvider,

    // Facades
    WasmFacade,

    // Services
    P2pOrdersService,

    // Repositories
    SellOrdersBookRepository,
    Krc20ActionsService,
    Krc20TransactionsService,
    RpcService,
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
      [{ name: SellOrder.name, schema: SellOrderSchema }],
      MONGO_DATABASE_CONNECTIONS.P2P,
    ),
  ],
  exports: [],
})
export class BackendModule {}
