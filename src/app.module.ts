import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { BackendModule } from './modules/backend/application-modules/backend.module';
import { ServiceCommunicationMiddleware } from './modules/core/middlewares/service-communication.middleware';
import { SERVICE_TYPE } from './modules/backend/constants';
import { ServiceTypeEnum } from './modules/core/enums/service-type.enum';
import { CronModule } from './modules/backend/application-modules/cron.module';
import { CoreModule } from './modules/core/core.module';
import { JobModule } from './modules/backend/application-modules/job.module';

const getCurrentModule = () => {
  switch (SERVICE_TYPE) {
    case ServiceTypeEnum.CRON:
      return CronModule;
    case ServiceTypeEnum.JOB:
      return JobModule;
    default:
      return BackendModule;
  }
};

@Module({
  imports: [CoreModule, getCurrentModule()],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ServiceCommunicationMiddleware).forRoutes('*');
  }
}
