import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { WithdrawalStatus } from "../enums/withdrawal-status.enum";
import { HydratedDocument } from "mongoose";

@Schema({
    versionKey: false,
    collection: 'p2p_withdrawals',
    timestamps: true
})
export class WithdrawalEntity {
    _id?: string;

    @Prop({ required: true })
    amount: number;

    @Prop({ required: true, index: true })
    ownerWallet: string;

    @Prop()
    receivingWallet: string;

    @Prop({ required: true })
    status: WithdrawalStatus;

    @Prop()
    transactionId?: string;

    @Prop()
    createdAt?: Date;

    @Prop()
    updatedAt?: Date;
}

export type WithdrawalDocument = HydratedDocument<WithdrawalEntity>;
export const WithdrawalSchema = SchemaFactory.createForClass(WithdrawalEntity);