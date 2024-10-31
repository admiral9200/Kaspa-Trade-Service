import { Module } from '@nestjs/common';
import { P2pController } from '../controllers/p2p.controller';
import { OrdersManagementProvider } from '../providers/orders-management.provider';
import { OrdersManagementController } from '../controllers/orders-management.controller';
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

@Module({
  controllers: [P2pController, OrdersManagementController, LunchpadController, AuthController, BatchMintController],
  providers: [...BASE_PROVIDERS, JwtWalletStrategy, OrdersManagementProvider, JwtWalletAuthGuard, SkipGuardsService, RolesGuard],
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
