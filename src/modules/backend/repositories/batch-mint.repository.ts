import { Injectable } from '@nestjs/common';
import { BatchMintEntity } from '../model/schemas/batch-mint.schema';
import { InjectModel } from '@nestjs/mongoose';
import { BaseRepository } from './base.repository';
import { MONGO_DATABASE_CONNECTIONS } from '../constants';
import { Model } from 'mongoose';

@Injectable()
export class BatchMintRepository extends BaseRepository<BatchMintEntity> {
  constructor(
    @InjectModel(BatchMintEntity.name, MONGO_DATABASE_CONNECTIONS.P2P)
    private readonly batchMintModel: Model<BatchMintEntity>,
  ) {
    super(batchMintModel);
  }
}
