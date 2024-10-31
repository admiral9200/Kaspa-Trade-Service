import { Injectable } from '@nestjs/common';
import { BatchMintProvider } from '../providers/batch-mint.provider';

interface JobParams {
  'batch-mint'?: string;
}

@Injectable()
export class CliJobManager {
  constructor(private readonly bacthMintProvider: BatchMintProvider) {}

  async handleJob() {
    const args = process.argv.slice(2);
    const params: JobParams = args.reduce((acc, arg) => {
      const [key, value] = arg.split('=');
      if (key) {
        acc[key] = value || null;
      }
      return acc;
    }, {} as JobParams);

    if (params['batch-mint']) {
      await this.bacthMintProvider.startBatchMintJob(params['batch-mint']);
    } else {
      console.log(`No job found.`);
    }
  }
}
