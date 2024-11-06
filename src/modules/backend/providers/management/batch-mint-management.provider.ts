import { Injectable } from '@nestjs/common';
import { PodJobProvider } from '../pod-job-provider';

@Injectable()
export class BatchMintManagementProvider {
  constructor(private readonly podJobProvider: PodJobProvider) {}

  async startBatchMintPod(id: string): Promise<void> {
    return await this.podJobProvider.startBatchMintingJob(id);
  }
}
