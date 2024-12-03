export class InvalidWalletSequenceIdError extends Error {
    constructor(public readonly walletAddress?: string) {
      super(`Failed to get sequence Id. Wallet Address: ${walletAddress || '--'}`);
      this.name = 'InvalidWalletSequenceIdError';
    }
  }
  