import { Module, NestModule } from '@nestjs/common';
import { CoreModule } from './modules/core/core.module';
import { CronModule } from './modules/backend/cron.module';

@Module({
  imports: [CoreModule, CronModule],
  providers: [],
})
export class CronAppModule implements NestModule {
  configure() {}
}
