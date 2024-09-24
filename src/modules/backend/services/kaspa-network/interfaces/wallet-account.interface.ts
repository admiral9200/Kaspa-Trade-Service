import { PrivateKey } from 'libs/kaspa-dev/kaspa';

export interface WalletAccount {
  privateKey: PrivateKey;
  address: string;
}
