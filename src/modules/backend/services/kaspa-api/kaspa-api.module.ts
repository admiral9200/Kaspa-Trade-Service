import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { KaspaApiService } from './services/kaspa-api.service';
import { AppConfigModule } from 'src/modules/core/modules/config/app-config.module';
import { AppConfigService } from 'src/modules/core/modules/config/app-config.service';
import { UtilsHelper } from '../../helpers/utils.helper';

@Module({
  imports: [
    HttpModule.registerAsync({
      imports: [AppConfigModule],
      useFactory: async (configService: AppConfigService) => ({
        baseURL: configService.getKaspaApiUrl,
        timeout: 5000,
        maxRedirects: 5,
      }),
      inject: [AppConfigService],
    }),
  ],
  providers: [KaspaApiService, UtilsHelper],
  exports: [KaspaApiService],
})
export class KaspaApiModule {}
