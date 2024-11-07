export enum IndexerStatusMessage {
  Synced = 'synced',
  Unsynced = 'unsynced',
}

export interface IndexerStatus {
  message: IndexerStatusMessage;
  result: {
    daaScore: string;
    opScore: string;
    opTotal: string;
    tokenTotal: string;
    feeTotal: string;
  };
}
