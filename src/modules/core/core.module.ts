import { Module } from '@nestjs/common';
import { HealthController } from './controllers/health.controller';
import { TerminusModule } from '@nestjs/terminus';
import { AppConfigModule } from './modules/config/app-config.module';
// import { AppRequestLoggerModule } from './modules/logger/request-logger/app-request-logger.module';
import { AppMailerModule } from './modules/mailer/app-mailer.module';
import { AppLoggerModule } from './modules/logger/app-logger.module';
import { AppLogger } from './modules/logger/app-logger.abstract';
import { AppRequestLoggerService } from './modules/logger/app-request-logger.service';

@Module({
  controllers: [HealthController],
  providers: [
    AppRequestLoggerService,
    {
      provide: AppLogger,
      useClass: AppRequestLoggerService,
    },
  ],
  imports: [AppConfigModule, AppLoggerModule.forRoot(), AppMailerModule.forRoot(), TerminusModule],
})
export class CoreModule {}
