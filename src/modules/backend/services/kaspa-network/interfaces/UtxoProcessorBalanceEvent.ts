export interface UtxoProcessorBalanceEvent {
  type: 'balance';
  data: {
    balance: {
      mature: number;
      pending: number;
      outgoing: number;
      matureUtxoCount: number;
      pendingUtxoCount: number;
      stasisUtxoCount: number;
    };
    id: string;
  };
}
