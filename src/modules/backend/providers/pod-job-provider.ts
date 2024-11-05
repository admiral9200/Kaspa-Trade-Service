import { Injectable } from '@nestjs/common';
import * as childProcess from 'child_process';
import { CliJobParams } from '../cli-job-manager/cli-job.manager';

@Injectable()
export class PodJobProvider {
  constructor() {}

  private async startPodJob(jobParams: CliJobParams, keepOpen = false): Promise<void> {
    return;
    const jobName = Object.keys(jobParams)[0];
    const isWindows = process.platform === 'win32';

    if (!jobName) {
      throw new Error('Job name not found');
    }

    let command = `npm run ${isWindows ? 'start:job-win' : 'start:job'} ${jobName}=${jobParams[jobName]}`;

    if (keepOpen) {
      command = isWindows ? `cmd.exe /k "${command}"` : `bash -c "${command} && read -p 'Press Enter to continue...'"`;
    }

    const podProcess = childProcess.spawn(command, {
      cwd: process.cwd(),
      shell: true,
      detached: true,
      stdio: 'ignore', // This makes it fully detached by ignoring stdio
    });

    podProcess.unref(); // Allow the child process to continue running after the parent exits
  }

  async startBatchMintingJob(id: string): Promise<void> {
    return await this.startPodJob({ 'batch-mint': id });
  }
}
