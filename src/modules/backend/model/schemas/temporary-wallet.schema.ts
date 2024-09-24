import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({
  versionKey: false,
  collection: 'p2p_temp_order_wallets',
  timestamps: true,
})
export class TemporaryWallet {
  _id?: string;

  @Prop({ required: true })
  address: string;

  @Prop({ default: false })
  isInUse: boolean;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export type TemporaryWalletDocument = HydratedDocument<TemporaryWallet>;
export const TemporaryWalletSchema = SchemaFactory.createForClass(TemporaryWallet);
