import { LunchpadOrderStatus, LunchpadStatus } from '../model/enums/lunchpad-statuses.enum';
import { LunchpadOrder } from '../model/schemas/lunchpad-order.schema';
import { LunchpadEntity } from '../model/schemas/lunchpad.schema';

export type ClientSideLunchpad = {
  id: string;
  ticker: string;
  availabeUnits: number;
  status: LunchpadStatus;
  kasPerUnit: number;
  tokenPerUnit: number;
  minimumUnitsPerOrder?: number;
  walletAddress?: string;
  krc20TokensAmount?: number;
};

export type ClientSideLunchpadWithStatus = {
  success: boolean;
  errorCode?: number;
  lunchpad: ClientSideLunchpad;
};

export type ClientSideLunchpadOrder = {
  id: string;
  totalUnits: number;
  kasPerUnit: number;
  tokenPerUnit: number;
  status: LunchpadOrderStatus;
  createdAt: Date;
};

export type ClientSideLunchpadOrderWithStatus = {
  success: boolean;
  errorCode?: number;
  lunchpad?: ClientSideLunchpad;
  lunchpadOrder: ClientSideLunchpadOrder;
};

export class LunchpadTransformer {
  static transformLunchpadDataToClientSide(
    data: LunchpadEntity,
    walletAddress?: string,
    krc20TokensAmount?: number,
  ): ClientSideLunchpad {
    return {
      id: data._id,
      ticker: data.ticker,
      availabeUnits: data.availabeUnits,
      status: data.status,
      kasPerUnit: data.kasPerUnit,
      tokenPerUnit: data.tokenPerUnit,
      minimumUnitsPerOrder: data.minimumUnitsPerOrder,
      walletAddress,
      krc20TokensAmount: krc20TokensAmount,
    };
  }

  static transformLunchpadOrderDataToClientSide(data: LunchpadOrder): ClientSideLunchpadOrder {
    return {
      id: data._id,
      totalUnits: data.totalUnits,
      kasPerUnit: data.kasPerUnit,
      tokenPerUnit: data.tokenPerUnit,
      status: data.status,
      createdAt: data.createdAt,
    };
  }
}
