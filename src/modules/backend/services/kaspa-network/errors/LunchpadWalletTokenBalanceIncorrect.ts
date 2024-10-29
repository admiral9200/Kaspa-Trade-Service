export class LunchpadWalletTokenBalanceIncorrect extends Error {
  constructor(
    public readonly token: string,
    public readonly wallet: string,
    public readonly expectedBalance: number,
    public readonly actualBalance: number,
  ) {
    super(
      `Lunchpad wallet token balance is incorrect. Expected ${expectedBalance} but got ${actualBalance} for token ${token}. wallet: ${wallet}`,
    );
    this.name = 'LunchpadWalletTokenBalanceIncorrect';
  }
}
