import {Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {HydratedDocument, SchemaTypes} from 'mongoose';
import {SellOrderStatus} from "../enums/sell-order-status.enum";

@Schema({
    versionKey: false,
    collection: 'p2p_sell_orders',
    timestamps: true,
})
export class SellOrder {
    _id?: string;

    @Prop({ required: true })
    token: string;

    @Prop({ required: true })
    quantity: number;

    @Prop({ required: true })
    atPrice: number;

    @Prop({ required: true })
    temporaryWalletId: string;

    @Prop()
    walletAddress: string;

    @Prop()
    status?: SellOrderStatus;

    @Prop()
    createdAt?: Date;

    @Prop()
    updatedAt?: Date;
}

export type SellOrderDocument = HydratedDocument<SellOrder>;
export const SellOrderSchema = SchemaFactory.createForClass(SellOrder);
