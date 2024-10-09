import { Module, Global, DynamicModule } from '@nestjs/common';
import { AppConfigModule } from '../config/app-config.module';
import { createLogger, format, transports } from 'winston';
import { AppConfigService } from '../config/app-config.service';
import { AppLogger } from './app-logger.abstract';
import { AppRequestLoggerService } from './app-request-logger.service';
import { AppGlobalLoggerService } from './app-global-logger.service';
import { SERVICE_TYPE } from 'src/modules/backend/constants';
import { ServiceTypeEnum } from '../../enums/service-type.enum';

@Global()
@Module({})
export class AppLoggerModule {
  static forRoot(): DynamicModule {
    return {
      module: AppLoggerModule,
      imports: [AppConfigModule],
      providers: [
        {
          provide: 'LOGGER',
          useFactory: (config: AppConfigService) => {
            return createLogger({
              level: 'info',
              format: format.combine(format.timestamp(), format.errors({ stack: true }), format.splat(), format.json()),
              defaultMeta: {
                service: config.getServiceName,
              },
              transports: [
                new transports.Console({
                  format: format.combine(format.colorize(), format.simple()),
                }),
                // Add transport for APM and such
              ],
            });
          },
          inject: [AppConfigService],
        },
        {
          provide: AppLogger, // Provide the abstract class
          useClass: SERVICE_TYPE == ServiceTypeEnum.API ? AppRequestLoggerService : AppGlobalLoggerService, // Use the concrete implementation
        },
      ],
      exports: ['LOGGER', AppLogger],
    };
  }
}
