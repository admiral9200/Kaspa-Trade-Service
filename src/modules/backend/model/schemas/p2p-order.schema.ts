import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { SellOrderStatus } from '../enums/sell-order-status.enum';

@Schema({
  versionKey: false,
  collection: 'p2p_orders',
  timestamps: true,
})
export class P2pOrderEntity {
  _id?: string;

  @Prop({ required: true })
  ticker: string;

  @Prop({ required: true })
  quantity: number;

  @Prop({ required: true })
  pricePerToken: number;

  @Prop({ required: true })
  totalPrice: number;

  @Prop({ required: true })
  walletSequenceId: number;

  @Prop({ required: true })
  sellerWalletAddress: string;

  @Prop()
  buyerWalletAddress?: string;

  @Prop()
  status?: SellOrderStatus;

  @Prop()
  fulfillmentTimestamp?: number;

  @Prop()
  error?: string;

  @Prop()
  expiresAt?: Date;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export type OrderDocument = HydratedDocument<P2pOrderEntity>;
export const P2pOrderSchema = SchemaFactory.createForClass(P2pOrderEntity);
