import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes } from 'mongoose';
import { SellOrderStatus } from '../enums/sell-order-status.enum';

@Schema({
  versionKey: false,
  collection: 'p2p_orders',
  timestamps: true,
})
export class P2pOrder {
  _id?: string;

  @Prop({ required: true })
  ticker: string;

  @Prop({ required: true })
  quantity: number;

  @Prop({ required: true })
  atPrice: number;

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
  expiresAt?: Date;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export type OrderDocument = HydratedDocument<P2pOrder>;
export const P2pOrderSchema = SchemaFactory.createForClass(P2pOrder);
