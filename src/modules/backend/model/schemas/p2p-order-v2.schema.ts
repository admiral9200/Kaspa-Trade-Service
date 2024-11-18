import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { SwapTransactionsResult } from '../../services/kaspa-network/interfaces/SwapTransactionsResult.interface';
import { SellOrderStatusV2 } from '../enums/sell-order-status-v2.enum';

@Schema({
  versionKey: false,
  collection: 'p2p_orders_v2',
  timestamps: true,
})
export class P2pOrderV2Entity {
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
  sellerWalletAddress: string;

  @Prop()
  buyerWalletAddress?: string;

  @Prop()
  status?: SellOrderStatusV2;

  @Prop()
  fulfillmentTimestamp?: number;

  @Prop({ type: Object })
  transactions?: Partial<SwapTransactionsResult>;

  @Prop({ required: true, unique: true })
  psktSeller: string;

  @Prop({ type: String })
  psktTransactionId: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export type OrderV2Document = HydratedDocument<P2pOrderV2Entity>;
export const P2pOrderV2Schema = SchemaFactory.createForClass(P2pOrderV2Entity);
P2pOrderV2Schema.index({ ticker: 1, status: 1 });
