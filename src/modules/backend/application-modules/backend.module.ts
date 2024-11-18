import { Module } from '@nestjs/common';
import { P2pController } from '../controllers/p2p.controller';
import { OrdersManagementProvider } from '../providers/management/orders-management.provider';
import { OrdersManagementController } from '../controllers/management/orders-management.controller';
import { LunchpadController } from '../controllers/lunchpad.controller';
import { BASE_IMPORTS, BASE_PROVIDERS } from './shared-modules-data';
import { AuthController } from '../controllers/auth.controller';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AppConfigModule } from 'src/modules/core/modules/config/app-config.module';
import { AppConfigService } from 'src/modules/core/modules/config/app-config.service';
import { JwtWalletStrategy } from '../guards/jwt-wallet.strategy';
import { JwtWalletAuthGuard } from '../guards/jwt-wallet-auth.guard';
import { SkipGuardsService } from '../guards/infra/skipGuardsService';
import { RolesGuard } from '../guards/roles.guard';
import { BatchMintController } from '../controllers/batch-mint.controller';
import { BatchMintManagementController } from '../controllers/management/batch-mint-management.controller';
import { BatchMintManagementProvider } from '../providers/management/batch-mint-management.provider';
import { LunchpadManagementController } from '../controllers/management/lunchpad-management.controller';
import { LunchpadManagementProvider } from '../providers/management/lunchpad-management.provider';
import { P2pV2Controller } from '../controllers/p2p-v2.controller';

@Module({
  controllers: [
    P2pController,
    P2pV2Controller,
    OrdersManagementController,
    LunchpadController,
    LunchpadManagementController,
    AuthController,
    BatchMintController,
    BatchMintManagementController,
  ],
  providers: [
    ...BASE_PROVIDERS,
    JwtWalletStrategy,
    OrdersManagementProvider,
    BatchMintManagementProvider,
    LunchpadManagementProvider,
    JwtWalletAuthGuard,
    SkipGuardsService,
    RolesGuard,
  ],
  imports: [
    ...BASE_IMPORTS,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: async (config: AppConfigService) => ({
        secret: config.jwtSecretKey,
        signOptions: { expiresIn: '4h' },
      }),
    }),
  ],
  exports: [],
})
export class BackendModule {}
