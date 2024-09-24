import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes } from 'mongoose';

@Schema({
  versionKey: false,
  collection: 'p2p_temp_wallets_sequence',
  timestamps: true,
})
export class TemporaryWalletsSequence {
  _id?: string;

  @Prop({ required: true })
  sequence: number;
}

export type TemporaryWalletsSequenceDocument = HydratedDocument<TemporaryWalletsSequence>;
export const TemporaryWalletsSequenceSchema = SchemaFactory.createForClass(TemporaryWalletsSequence);
