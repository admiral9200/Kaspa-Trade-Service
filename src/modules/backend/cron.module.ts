import { Module, OnModuleInit } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfigService } from '../core/modules/config/app-config.service';
import { MONGO_DATABASE_CONNECTIONS } from './constants';
import { AppConfigModule } from '../core/modules/config/app-config.module';
import { P2pOrderEntity, P2pOrderSchema } from './model/schemas/p2p-order.schema';
import { TemporaryWalletsSequence, TemporaryWalletsSequenceSchema } from './model/schemas/temporary-wallets-sequence.schema';
import { KaspaApiModule } from './services/kaspa-api/kaspa-api.module';
import { KasplexApiModule } from './services/kasplex-api/kasplex-api.module';
import { ScheduleModule } from '@nestjs/schedule';
import { TelegramNotifierModule } from '../shared/telegram-notifier/telegram-notifier.module';
import { P2pOrdersExpirationCronJob } from './cron-jobs/p2p-orders-expiration.cron-job';
import { ServiceTypeEnum } from '../core/enums/service-type.enum';
import { BASE_PROVIDERS } from './backend.module';

const serviceType: ServiceTypeEnum = (process.env.SERVICE_TYPE || ServiceTypeEnum.API).trim() as ServiceTypeEnum;
console.log('Cron module loaded - service running on mode:', serviceType);

@Module({
  providers: [...BASE_PROVIDERS, P2pOrdersExpirationCronJob],
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
export class CronModule implements OnModuleInit {
  onModuleInit() {}
}
