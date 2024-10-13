import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { BackendModule } from './modules/backend/application-modules/backend.module';
import { CoreModule } from './modules/core/core.module';
import { ServiceCommunicationMiddleware } from './modules/core/middlewares/service-communication.middleware';
import { SERVICE_TYPE } from './modules/backend/constants';
import { ServiceTypeEnum } from './modules/core/enums/service-type.enum';
import { CronModule } from './modules/backend/application-modules/cron.module';

@Module({
  imports: [CoreModule, SERVICE_TYPE === ServiceTypeEnum.CRON ? CronModule : BackendModule],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ServiceCommunicationMiddleware).forRoutes('*');
  }
}
