export enum AuthType {
  USER = 'user', // For future use
  WALLET = 'wallet',
}

export interface AuthWalletInfo {
  walletAddress: string;
  authType: AuthType;
  userRoles?: UserRoleEnum[];
}

export enum UserRoleEnum {
  SYS_ADMIN = -1,
  LISTING_MANAGER = 1,
}
