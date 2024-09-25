import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { KasplexApiService } from './services/kasplex-api.service';
import { AppConfigModule } from 'src/modules/core/modules/config/app-config.module';
import { AppConfigService } from 'src/modules/core/modules/config/app-config.service';
import { UtilsHelper } from '../../helpers/utils.helper';

@Module({
  imports: [
    HttpModule.registerAsync({
      imports: [AppConfigModule],
      useFactory: async (configService: AppConfigService) => ({
        baseURL: configService.getKrc20ServiceUrl,
        timeout: 5000,
        maxRedirects: 5,
      }),
      inject: [AppConfigService],
    }),
  ],
  providers: [KasplexApiService, UtilsHelper],
  exports: [KasplexApiService],
})
export class KasplexApiModule {}
