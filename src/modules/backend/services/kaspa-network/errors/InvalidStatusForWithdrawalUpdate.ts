export class InvalidStatusForWithdrawalUpdateError extends Error {
    constructor(public readonly withdrawalId?: string) {
      super(`Invalid status for withdrawal update. Withdrawal ID: ${withdrawalId || '--'}`);
      this.name = 'InvalidStatusForWithdrawalUpdateError';
    }
  }
  