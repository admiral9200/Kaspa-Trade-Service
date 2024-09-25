import { Module } from '@nestjs/common';
import { HealthController } from './controllers/health.controller';
import { TerminusModule } from '@nestjs/terminus';
import { AppConfigModule } from './modules/config/app-config.module';
import { AppLoggerModule } from './modules/logger/app-logger.module';
import { AppMailerModule } from './modules/mailer/app-mailer.module';
import { ServiceCommunicationMiddleware } from './middlewares/service-communication.middleware';

@Module({
  controllers: [HealthController],
  providers: [ServiceCommunicationMiddleware],
  imports: [AppConfigModule, AppLoggerModule.forRoot(), AppMailerModule.forRoot(), TerminusModule],
})
export class CoreModule {}
