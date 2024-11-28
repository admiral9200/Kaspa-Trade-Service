import { Module } from '@nestjs/common';
import { BASE_IMPORTS, BASE_PROVIDERS } from './shared-modules-data';
import { CliJobManager } from '../cli-job-manager/cli-job.manager';

@Module({
  providers: [...BASE_PROVIDERS, CliJobManager],
  imports: [...BASE_IMPORTS],
  exports: [],
})
export class JobModule {
  constructor() {}
}
