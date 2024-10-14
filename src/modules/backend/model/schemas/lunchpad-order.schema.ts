import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { WalletPrivateKeyExposedRecord } from '../../services/kaspa-network/interfaces/WalletPrivateKeyExposedRecord.interface';
import { LunchpadOrderStatus } from '../enums/lunchpad-statuses.enum';

@Schema({
  versionKey: false,
  collection: 'lunchpad_orders',
  timestamps: true,
})
export class LunchpadOrder {
  _id?: string;

  @Prop({ required: true })
  lunchpadId: string;

  @Prop({ required: true })
  totalUnits: number;

  @Prop({ required: true })
  kasPerUnit: number;

  @Prop({ required: true })
  tokenPerUnit: number;

  @Prop({ required: true, default: LunchpadOrderStatus.WAITING_FOR_KAS })
  status: LunchpadOrderStatus;

  @Prop({ required: true })
  userWalletAddress: string;

  @Prop({ type: Array })
  walletKeyExposedBy?: WalletPrivateKeyExposedRecord[];

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export type LunchpadOrderDocument = HydratedDocument<LunchpadOrder>;
export const LunchpadOrderSchema = SchemaFactory.createForClass(LunchpadOrder);
