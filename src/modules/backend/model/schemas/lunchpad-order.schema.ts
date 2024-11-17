import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { WalletPrivateKeyExposedRecord } from '../../services/kaspa-network/interfaces/WalletPrivateKeyExposedRecord.interface';
import { LunchpadOrderStatus } from '../enums/lunchpad-statuses.enum';
import { KRC20ActionTransations } from '../../services/kaspa-network/interfaces/Krc20ActionTransactions.interface';

@Schema({
  versionKey: false,
  collection: 'lunchpad_orders',
  timestamps: true,
})
export class LunchpadOrder {
  _id?: string;

  @Prop({ required: true })
  lunchpadId: string; // Index

  @Prop({ required: true })
  totalUnits: number;

  @Prop({ required: true, default: LunchpadOrderStatus.WAITING_FOR_KAS })
  status: LunchpadOrderStatus;

  @Prop({ required: true })
  userWalletAddress: string;

  @Prop({ required: true })
  roundNumber: number;

  @Prop({ unique: true, sparse: true }) // Unique for not null
  userTransactionId?: string;

  @Prop({ type: Array })
  walletKeyExposedBy?: WalletPrivateKeyExposedRecord[];

  @Prop({ type: Object })
  transactions?: Partial<KRC20ActionTransations>;

  @Prop()
  error?: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export type LunchpadOrderDocument = HydratedDocument<LunchpadOrder>;
export const LunchpadOrderSchema = SchemaFactory.createForClass(LunchpadOrder);
