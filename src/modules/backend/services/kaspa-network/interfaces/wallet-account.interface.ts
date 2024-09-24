import { PrivateKey } from 'libs/kaspa/kaspa';

export interface WalletAccount {
  privateKey: PrivateKey;
  address: string;
}
