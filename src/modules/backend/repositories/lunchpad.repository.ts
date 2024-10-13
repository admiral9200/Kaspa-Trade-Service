import { Injectable } from '@nestjs/common';
import { BaseRepository } from './base.repository';
import { LunchpadEntity } from '../model/schemas/lunchpad.schema';
import { InjectModel } from '@nestjs/mongoose';
import { MONGO_DATABASE_CONNECTIONS } from '../constants';
import { Model } from 'mongoose';

@Injectable()
export class LunchpadRepository extends BaseRepository<LunchpadEntity> {
  constructor(
    @InjectModel(LunchpadEntity.name, MONGO_DATABASE_CONNECTIONS.P2P)
    private readonly sellOrdersModel: Model<LunchpadEntity>,
  ) {
    super(sellOrdersModel);
  }
}
