import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { WalletPrivateKeyExposedRecord } from '../../services/kaspa-network/interfaces/WalletPrivateKeyExposedRecord.interface';
import { LunchpadStatus } from '../enums/lunchpad-statuses.enum';

export const MIN_KAS_PER_UNIT = 1;

@Schema({
  versionKey: false,
  collection: 'lunchpads',
  timestamps: true,
})
export class LunchpadEntity {
  _id?: string;

  @Prop({ required: true })
  ticker: string;

  @Prop({ required: true })
  availabeUnits: number;

  @Prop({ required: true })
  kasPerUnit: number;

  @Prop({ required: true })
  tokenPerUnit: number;

  @Prop({ required: true })
  walletSequenceId: number;

  @Prop({ required: true })
  ownerWallet: string;

  @Prop({ required: true })
  status: LunchpadStatus;

  @Prop()
  minimumUnitsPerOrder?: number;

  @Prop({ type: Array })
  walletKeyExposedBy?: WalletPrivateKeyExposedRecord[];

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export type OrderDocument = HydratedDocument<LunchpadEntity>;
export const LunchpadEntitySchema = SchemaFactory.createForClass(LunchpadEntity);
