import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { WithdrawalStatus } from "../enums/withdrawal-status.enum";
import { HydratedDocument } from "mongoose";

@Schema({
    versionKey: false,
    collection: 'p2p_withdrawals',
    timestamps: true
})
export class P2pWithdrawalEntity {
    _id?: string;

    @Prop({ required: true })
    amount?: number;

    @Prop({ required: true })
    ownerWallet?: string;

    @Prop({ required: true })
    receivingWallet?: string;

    @Prop({ required: true })
    status?: WithdrawalStatus;

    @Prop()
    createdAt?: Date;

    @Prop()
    updatedAt?: Date;
}

export type WithdrawalDocument = HydratedDocument<P2pWithdrawalEntity>;
export const P2pWithdrawalSchema = SchemaFactory.createForClass(P2pWithdrawalEntity);