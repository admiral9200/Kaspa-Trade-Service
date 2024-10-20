import { Module, OnModuleInit } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { P2pOrdersExpirationCronJob } from '../cron-jobs/p2p-orders-expiration.cron-job';
import { BASE_IMPORTS, BASE_PROVIDERS } from './shared-modules-data';
import { P2pTemporaryWalletsSequenceRepository } from '../repositories/p2p-temporary-wallets-sequence.repository';

@Module({
  providers: [...BASE_PROVIDERS, P2pOrdersExpirationCronJob],
  imports: [...BASE_IMPORTS, ScheduleModule.forRoot()],
  exports: [],
})
export class CronModule implements OnModuleInit {
  constructor(private readonly temporaryWalletsSequenceRepository: P2pTemporaryWalletsSequenceRepository) {}

  async onModuleInit() {
    await this.temporaryWalletsSequenceRepository.createSequenceIfNotExists();
  }
}
