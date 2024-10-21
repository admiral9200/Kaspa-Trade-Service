import { Module, OnModuleInit } from '@nestjs/common';
import { P2pController } from '../controllers/p2p.controller';
import { OrdersManagementProvider } from '../providers/orders-management.provider';
import { OrdersManagementController } from '../controllers/orders-management.controller';
import { LunchpadController } from '../controllers/lunchpad.controller';
import { BASE_IMPORTS, BASE_PROVIDERS } from './shared-modules-data';
import { BatchMintController } from '../controllers/batch-mint.controller';

@Module({
  controllers: [P2pController, OrdersManagementController, LunchpadController, BatchMintController],
  providers: [...BASE_PROVIDERS, OrdersManagementProvider],
  imports: [...BASE_IMPORTS],
  exports: [],
})
export class BackendModule implements OnModuleInit {
  onModuleInit() {}
}
