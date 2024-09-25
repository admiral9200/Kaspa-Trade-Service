import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { P2pTemporaryWalletsRepository } from '../repositories/p2p-temporary-wallets.repository';
import { P2pTemporaryWalletsSequenceRepository } from '../repositories/p2p-temporary-wallets-sequence.repository';
import { TemporaryWallet } from '../model/schemas/temporary-wallet.schema';

@Injectable()
export class TemporaryWalletService {
  constructor(
    private readonly temporaryWalletsSequenceRepository: P2pTemporaryWalletsSequenceRepository,
    private readonly temporaryWalletRepository: P2pTemporaryWalletsRepository,
  ) {}

  public async generateSequenceId(): Promise<number> {
    return await this.temporaryWalletsSequenceRepository.increment();
  }

  async create(walletSequenceId: number, temporaryWalletAddress: string): Promise<TemporaryWallet> {
    const wallet: TemporaryWallet = await this.temporaryWalletRepository.createTemporaryWallet(
      walletSequenceId,
      temporaryWalletAddress,
    );
    if (!wallet) {
      throw new HttpException('Failed to create a temporary wallet', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return wallet;
  }
}
