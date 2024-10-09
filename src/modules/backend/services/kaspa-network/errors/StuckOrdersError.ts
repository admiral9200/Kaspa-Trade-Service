import { P2pOrderEntity } from 'src/modules/backend/model/schemas/p2p-order.schema';

export class StuckOrdersError extends Error {
  protected ordersId: string[];

  constructor(orders: P2pOrderEntity[]) {
    super(`Stuck orders: ${orders.map((o) => o._id).join(', ')}`);
    this.ordersId = orders.map((o) => o._id);
  }
}
