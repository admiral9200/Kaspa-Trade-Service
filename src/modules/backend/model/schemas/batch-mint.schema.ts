import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { WalletPrivateKeyExposedRecord } from '../../services/kaspa-network/interfaces/WalletPrivateKeyExposedRecord.interface';
import { BatchMintStatus } from '../enums/batch-mint-statuses.enum';
import { KRC20ActionTransations } from '../../services/kaspa-network/interfaces/Krc20ActionTransactions.interface';

@Schema({
  versionKey: false,
  collection: 'batch_mints',
  timestamps: true,
})
export class BatchMintEntity {
  _id?: string;

  @Prop({ required: true })
  ticker: string;

  @Prop({ required: true })
  totalMints: number;

  @Prop({ required: true })
  finishedMints: number;

  @Prop({ required: true, index: true })
  ownerWallet: string;

  @Prop({ required: true })
  maxPriorityFee: number;

  @Prop({ required: true })
  stopMintsAtMintsLeft: number;

  @Prop({ required: true })
  walletSequenceId: number;

  @Prop({ required: true, index: true })
  status: BatchMintStatus;

  @Prop()
  isReachedMintLimit?: boolean;

  @Prop()
  isUserCanceled?: boolean;

  @Prop({ type: Array })
  transactions?: Partial<KRC20ActionTransations>[];

  @Prop({ type: Object })
  transferTokenTransactions?: Partial<KRC20ActionTransations>;

  @Prop()
  refundTransactionId?: string;

  @Prop({ type: Array })
  walletKeyExposedBy?: WalletPrivateKeyExposedRecord[];

  @Prop()
  error?: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export type BatchMintDocument = HydratedDocument<BatchMintEntity>;
export const BatchMintEntitySchema = SchemaFactory.createForClass(BatchMintEntity);
