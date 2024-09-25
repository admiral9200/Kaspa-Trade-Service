import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { BackendModule } from './modules/backend/backend.module';
import { CoreModule } from './modules/core/core.module';
import { ServiceCommunicationMiddleware } from './modules/core/middlewares/service-communication.middleware';

@Module({
  imports: [CoreModule, BackendModule],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ServiceCommunicationMiddleware).forRoutes('*');
  }
}
