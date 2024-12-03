import { P2pOrderV2Entity } from 'src/modules/backend/model/schemas/p2p-order-v2.schema';

export class SellOrderPsktVerificationFailed extends Error {
  constructor(
    public readonly order: P2pOrderV2Entity,
    public readonly validationError: any,
  ) {
    super(`Failed to verify order ${order._id} pskt. validation error: ${validationError?.message || validationError}`);
    this.name = 'SellOrderPsktVerificationFailed';
  }
}
