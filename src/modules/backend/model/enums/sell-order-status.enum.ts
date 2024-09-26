export enum SellOrderStatus {
  WAITING_FOR_TOKENS = 'WAITING_FOR_TOKENS',
  LISTED_FOR_SALE = 'LISTED_FOR_SALE',
  WAITING_FOR_KAS = 'WAITING_FOR_KAS',
  CHECKOUT = 'CHECKOUT',
  WAITING_FOR_LOW_FEE = 'WAITING_FOR_LOW_FEE',
  COMPLETED = 'COMPLETED',
  CANCELED = 'CANCELED',
  SWAP_ERROR = 'SWAP_ERROR',

  // ACTIONS FLOW
  OFF_MARKETPLACE = 'OFF_MARKETPLACE',
  DELISTING = 'DELISTING',
  DELIST_ERROR = 'DELIST_ERROR',
  COMPLETED_DELISTING = 'COMPLETED_DELISTING',
}
