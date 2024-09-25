import { Injectable } from '@nestjs/common';
import { P2pTemporaryWalletsSequenceRepository } from '../repositories/p2p-temporary-wallets-sequence.repository';

@Injectable()
export class TemporaryWalletSequenceService {
  constructor(private readonly temporaryWalletsSequenceRepository: P2pTemporaryWalletsSequenceRepository) {}

  public async getNextSequenceId(): Promise<number> {
    return await this.temporaryWalletsSequenceRepository.increment();
  }
}
