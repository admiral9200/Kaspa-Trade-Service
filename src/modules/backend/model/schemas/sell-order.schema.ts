import {Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {HydratedDocument} from 'mongoose';
import {SellOrderStatus} from "../enums/sell-order-status.enum";

@Schema({
    versionKey: false,
    collection: 'p2p_sell_orders'
})
export class SellOrder {
    @Prop()
    _id?: string;

    @Prop({ required: true })
    token: string;

    @Prop({ required: true })
    quantity: number;

    @Prop({ required: true })
    atPrice: number;

    @Prop({ required: true })
    walletAddress: string;

    @Prop()
    status?: SellOrderStatus;

    @Prop({ required: true })
    createdAt?: Date;

    @Prop({ required: true })
    updatedAt?: Date;
}

export type SellOrderDocument = HydratedDocument<SellOrder>;
export const SellOrderSchema = SchemaFactory.createForClass(SellOrder);
