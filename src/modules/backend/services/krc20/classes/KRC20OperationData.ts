export interface KRC20OperationDataInterface {
  p: 'krc-20';
  op: 'mint' | 'deploy' | 'transfer';
  tick: string;
  to?: string;
  amt?: string;
  max?: string;
  lim?: string;
  dec?: '8';
  pre?: string;
}

export const KRC20_BASE_TRANSACTION_AMOUNT = 0.1;
export const KRC20_TRANSACTIONS_AMOUNTS = {
  DEPLOY: 1003,
  MINT: 2,
  TRANSFER: 1817 / 1e8,
};

export function getTransferData(
  ticker: string,
  amount: number,
  to: string,
): KRC20OperationDataInterface {
  return {
    p: 'krc-20',
    op: 'transfer',
    tick: ticker,
    to: to,
    amt: String(amount * 1e8),
  };
}

// Need to check to see if works
// export function getMintData(ticker: string): KRC20OperationDataInterface {
//   return {
//     p: 'krc-20',
//     op: 'mint',
//     tick: ticker,
//   };
// }

// Need to check to see if works
// export function getDeployData(
//   ticker: string,
//   max: number,
//   lim: number,
// ): KRC20OperationDataInterface {
//   return {
//     p: 'krc-20',
//     op: 'deploy',
//     tick: ticker,
//     max: String(max),
//     lim: String(lim),
//   };
// }
