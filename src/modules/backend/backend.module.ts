import {Module} from "@nestjs/common";
import {P2pController} from "./controllers/p2p.controller";
import {P2pProvider} from "./providers/p2p.provider";
import {HttpModule} from "@nestjs/axios";
import {P2pOrdersService} from "./services/p2p-orders.service";
import {MongooseModule} from "@nestjs/mongoose";
import {AppConfigService} from "../core/modules/config/app-config.service";
import {MONGO_DATABASE_CONNECTIONS} from "./constants";
import {AppConfigModule} from "../core/modules/config/app-config.module";
import {SellOrder, SellOrderSchema} from "./model/schemas/sell-order.schema";
import {SendKaspaService} from "./services/send-kaspa.service";
import {SellOrdersBookRepository} from "./repositories/sell-orders-book.repository";
import {WasmFacade} from "./facades/wasm.facade";
import {TemporaryWallet, TemporaryWalletSchema} from "./model/schemas/temporary-wallet.schema";
import {P2pTemporaryWalletsRepository} from "./repositories/p2p-temporary-wallets.repository";

@Module({
    controllers: [P2pController],
    providers: [

        // Providers
        P2pProvider,

        // Facades
        WasmFacade,

        // Services
        SendKaspaService,
        P2pOrdersService,

        // Repositories
        SellOrdersBookRepository,
        P2pTemporaryWalletsRepository
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
        MongooseModule.forFeature([
            {name: SellOrder.name, schema: SellOrderSchema},
            {name: TemporaryWallet.name, schema: TemporaryWalletSchema},
        ], MONGO_DATABASE_CONNECTIONS.P2P),
    ],
    exports: []
})
export class BackendModule {}