import { P2pOrderV2Entity } from 'src/modules/backend/model/schemas/p2p-order-v2.schema';

export class FailedOrderVerification extends Error {
  constructor(order: P2pOrderV2Entity) {
    super(`Failed to verify order ${order._id}`);
    this.name = 'FailedOrderVerification';
  }
}
