export enum OperationAcceptResult {
  SUCCESS = '1',
  PENDING = '0',
  ERROR = '-1',
}

export interface ITokenOperation {
  p: string;
  op: OperationType;
  tick: string;
  max: string;
  lim: string;
  dec: string;
  amt: string;
  from: string;
  to: string;
  opScore: string;
  hashRev: string;
  feeRev: string;
  txAccept: string;
  opAccept: OperationAcceptResult;
  opError: string;
  mtsAdd: string;
  mtsMod: string;
}

export enum OperationType {
  TRANSFER = 'transfer',
  MINT = 'mint',
  DEPLOY = 'deploy',
  LIST = 'list',
  SEND = 'send',
}

export interface ITokenOperationResponse {
  message: string;
  result: ITokenOperation[] | null;
}
