import { LunchpadOrderStatus, LunchpadStatus } from '../model/enums/lunchpad-statuses.enum';
import { LunchpadOrder } from '../model/schemas/lunchpad-order.schema';
import { LunchpadEntity } from '../model/schemas/lunchpad.schema';

export type LunchpadWalletsInfo = {
  receiverWalletKaspa: number;
  senderWalletKaspa: number;
};

export type ClientSideLunchpad = {
  id: string;
  ticker: string;
  availabeUnits: number;
  status: LunchpadStatus;
  kasPerUnit: number;
  tokenPerUnit: number;
  roundNumber: number;
  totalUnits: number;
  minUnitsPerOrder?: number;
  maxUnitsPerOrder?: number;
  walletAddress?: string;
  senderWalletAddress?: string;
  krc20TokensAmount?: number;
  requiredKaspa?: number;
  openOrders?: number;
  walletsInfo?: LunchpadWalletsInfo;
  useWhitelist?: boolean;
  maxUnitsPerWallet?: number;
  whitelistWalletAddresses?: string[];
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

export type ClientSideLunchpadListItem = {
  id: string;
  ticker: string;
  availabeUnits: number;
  status: LunchpadStatus;
  kasPerUnit: number;
  tokenPerUnit: number;
  roundNumber: number;
  useWhitelist?: boolean;
  maxUnitsPerWallet?: number;
};

export type ClientSideLunchpadListWithStatus = {
  success: boolean;
  errorCode?: number;
  lunchpads: ClientSideLunchpadListItem[];
  totalCount?: number;
  allTickers?: string[];
};

export class LunchpadTransformer {
  static transformLunchpadDataToClientSide(
    data: LunchpadEntity,
    walletAddress?: string,
    senderWalletAddress?: string,
    krc20TokensAmount?: number,
    requiredKaspa?: number,
    openOrders?: number,
    showWhitelistAddresses: boolean = false,
  ): ClientSideLunchpad {
    return {
      id: data._id,
      ticker: data.ticker,
      availabeUnits: data.availabeUnits,
      status: data.status,
      kasPerUnit: data.kasPerUnit,
      tokenPerUnit: data.tokenPerUnit,
      minUnitsPerOrder: data.minUnitsPerOrder,
      maxUnitsPerOrder: data.maxUnitsPerOrder,
      roundNumber: data.roundNumber,
      totalUnits: data.totalUnits,
      maxUnitsPerWallet: data.maxUnitsPerWallet,
      useWhitelist: data.useWhitelist,
      whitelistWalletAddresses: showWhitelistAddresses ? data.whitelistWalletAddresses : null,
      walletAddress,
      senderWalletAddress,
      krc20TokensAmount: krc20TokensAmount,
      requiredKaspa,
      openOrders,
    };
  }

  static transformLunchpadOrderDataToClientSide(
    data: LunchpadOrder,
    kasPerUnit: number,
    tokenPerUnit: number,
  ): ClientSideLunchpadOrder {
    return {
      id: data._id,
      totalUnits: data.totalUnits,
      kasPerUnit,
      tokenPerUnit,
      status: data.status,
      createdAt: data.createdAt,
    };
  }

  static transformLunchpadListDataWithStatusToClientSide(
    data: LunchpadEntity[],
    totalCount?: number,
  ): ClientSideLunchpadListWithStatus {
    return {
      success: true,
      lunchpads: data.map((lunchpad) => ({
        id: lunchpad._id,
        ticker: lunchpad.ticker,
        availabeUnits: lunchpad.availabeUnits,
        status: lunchpad.status,
        kasPerUnit: lunchpad.kasPerUnit,
        tokenPerUnit: lunchpad.tokenPerUnit,
        roundNumber: lunchpad.roundNumber,
        maxUnitsPerWallet: lunchpad.maxUnitsPerWallet,
        useWhitelist: lunchpad.useWhitelist,
      })),
      totalCount,
    };
  }
}
