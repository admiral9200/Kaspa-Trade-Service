import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { AppConfigModule } from 'src/modules/core/modules/config/app-config.module';
import { AppConfigService } from 'src/modules/core/modules/config/app-config.service';
import { KaspianoBackendApiService } from './services/kaspiano-backend-api.service';

@Module({
  imports: [
    HttpModule.registerAsync({
      imports: [AppConfigModule],
      useFactory: async (configService: AppConfigService) => {
        const baseURL = configService.getKaspianoBackendUrl;

        console.log(`Configuring HttpModule with baseURL: ${baseURL}`);

        return {
          baseURL,
          timeout: 400000,
          maxRedirects: 5,
          headers: {
            Authorization: configService.getServiceCommunicationSecretKey,
          },
          withCredentials: true,
        };
      },
      inject: [AppConfigService],
    }),
  ],
  providers: [KaspianoBackendApiService],
  exports: [KaspianoBackendApiService],
})
export class KaspianoBackendApiModule {}
