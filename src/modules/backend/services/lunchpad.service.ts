import { Injectable } from '@nestjs/common';
import { MONGO_DATABASE_CONNECTIONS } from '../constants';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { LunchpadRepository } from '../repositories/lunchpad.repository';
import { CreateLunchpadRequestDto } from '../model/dtos/lunchpad/create-lunchpad.dto';
import { LunchpadStatus } from '../model/enums/lunchpad-statuses.enum';

@Injectable()
export class LunchpadService {
  constructor(
    @InjectConnection(MONGO_DATABASE_CONNECTIONS.P2P) private connection: Connection,
    private readonly lunchpadRepository: LunchpadRepository,
  ) {}

  async createLunchpad(createLunchpadDto: CreateLunchpadRequestDto, ownerWallet: string, walletSequenceId: number) {
    return await this.lunchpadRepository.create({
      ticker: createLunchpadDto.ticker,
      kasPerUnit: createLunchpadDto.kasPerUnit,
      tokenPerUnit: createLunchpadDto.tokenPerUnit,
      walletSequenceId,
      ownerWallet,
      status: LunchpadStatus.CREATED,
      minimumUnitsPerOrder: createLunchpadDto.minimumUnitsPerOrder,
      availabeUnits: 0,
    });
  }
}
