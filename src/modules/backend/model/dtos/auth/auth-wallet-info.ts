export enum AuthType {
  USER = 'user', // For future use
  WALLET = 'wallet',
}

export interface AuthWalletInfo {
  walletAddress: string;
  authType: AuthType;
}
