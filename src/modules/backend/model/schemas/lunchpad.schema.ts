import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { WalletPrivateKeyExposedRecord } from '../../services/kaspa-network/interfaces/WalletPrivateKeyExposedRecord.interface';
import { LunchpadStatus } from '../enums/lunchpad-statuses.enum';

export const MIN_KAS_PER_UNIT = 1;
export const MIN_TOKEN_PER_UNIT = 1;
export const MIN_FEE_RATE_PER_TRANSACTION = 0.0001;

@Schema({
  versionKey: false,
  collection: 'lunchpads',
  timestamps: true,
})
export class LunchpadEntity {
  _id?: string;

  @Prop({ required: true, unique: true })
  ticker: string;

  @Prop({ required: true })
  availabeUnits: number;

  @Prop({ required: true })
  totalUnits: number;

  @Prop({ required: true })
  kasPerUnit: number;

  @Prop({ required: true })
  tokenPerUnit: number;

  @Prop({ required: true })
  maxFeeRatePerTransaction: number;

  @Prop({ required: true })
  walletSequenceId: number;

  @Prop({ required: true })
  ownerWallet: string;

  @Prop({ required: true })
  status: LunchpadStatus;

  @Prop({ required: true })
  roundNumber: number;

  @Prop({ required: true })
  currentTokensAmount: number;

  @Prop()
  minUnitsPerOrder?: number;

  @Prop()
  maxUnitsPerOrder?: number;

  @Prop({ type: Array })
  walletKeyExposedBy?: WalletPrivateKeyExposedRecord[];

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export type LunchpadDocument = HydratedDocument<LunchpadEntity>;
export const LunchpadEntitySchema = SchemaFactory.createForClass(LunchpadEntity);
