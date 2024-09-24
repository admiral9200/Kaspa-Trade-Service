import { Injectable } from '@nestjs/common';
import { BaseRepository } from './base.repository';
import { P2pOrder } from '../model/schemas/p2p-order.schema';
import { InjectModel } from '@nestjs/mongoose';
import { MONGO_DATABASE_CONNECTIONS } from '../constants';
import { Model } from 'mongoose';
import { TemporaryWallet } from '../model/schemas/temporary-wallet.schema';
import { TemporaryWalletsSequence } from '../model/schemas/temporary-wallets-sequence.schema';

@Injectable()
export class P2pTemporaryWalletsSequenceRepository extends BaseRepository<TemporaryWalletsSequence> {
  constructor(
    @InjectModel(TemporaryWalletsSequence.name, MONGO_DATABASE_CONNECTIONS.P2P)
    private readonly temporaryWalletModel: Model<TemporaryWalletsSequence>,
  ) {
    super(temporaryWalletModel);
  }

  async increment(): Promise<number> {
    const result = await this.temporaryWalletModel.findOneAndUpdate({}, { $inc: { sequence: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true }).exec();
    return result.sequence;
  }

  async getSequence(): Promise<number> {
    const result = await this.temporaryWalletModel.findOne({}).exec();
    return result.sequence;
  }

  async createSequenceIfNotExists() {
    const result = await this.temporaryWalletModel.findOne({}).exec();
    if (!result) {
      await this.temporaryWalletModel.create({ sequence: 0 });
    }
  }
}
