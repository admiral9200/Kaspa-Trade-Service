import { P2pOrderEntity } from 'src/modules/backend/model/schemas/p2p-order.schema';

export class UnknownMoneyError extends Error {
  constructor(
    public readonly walletAmount: bigint,
    public readonly order: P2pOrderEntity,
  ) {
    super(`Unknown money for order ${order._id}. Wallet amount is ${walletAmount}.`);
    this.name = 'UnknownMoneyError';
  }
}
