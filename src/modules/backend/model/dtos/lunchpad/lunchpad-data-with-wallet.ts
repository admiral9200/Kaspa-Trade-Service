import { LunchpadOrder } from '../../schemas/lunchpad-order.schema';
import { LunchpadEntity } from '../../schemas/lunchpad.schema';

export interface LunchpadDataWithWallet {
  success: boolean;
  errorCode?: number;
  lunchpad: LunchpadEntity;
  walletAddress: string;
  senderWalletAddress?: string;
  krc20TokensAmount?: number;
  requiredKaspa?: number;
}

export interface LunchpadOrderDataWithErrors {
  success: boolean;
  errorCode?: number;
  lunchpad?: LunchpadEntity;
  lunchpadOrder: LunchpadOrder;
}
