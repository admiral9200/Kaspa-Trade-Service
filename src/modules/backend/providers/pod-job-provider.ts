import { Injectable } from '@nestjs/common';
import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PodJobProvider {
  constructor() {}

  async startBatchMintingJob(id: string): Promise<void> {
    const podProcess = childProcess.spawn(
      'npm',
      ['run', process.platform === 'win32' ? 'start:job-win' : 'start:job', 'batch-mint=' + id],
      {
        cwd: process.cwd(),
        shell: true,
        detached: true,
        stdio: 'ignore', // This makes it fully detached by ignoring stdio
      },
    );

    podProcess.unref(); // Allow the child process to continue running after the parent exits

    // const logDir = path.join(process.cwd(), 'podLogs');
    // if (!fs.existsSync(logDir)) {
    //   fs.mkdirSync(logDir);
    // }
    // const logFile = path.join(logDir, `batch-mint-${id}.log`);
    // const logStream = fs.createWriteStream(logFile);
    // podProcess.stdout.pipe(logStream);
    // podProcess.stderr.pipe(logStream);
  }
}
