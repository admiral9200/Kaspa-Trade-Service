export enum LunchpadStatus {
  CREATED = 'CREATED',
  ACTIVE = 'ACTIVE',
  NO_UNITS_LEFT = 'NO_UNITS_LEFT', // Temporary status when there are no units left, but orders are not yet final
  SOLD_OUT = 'SOLD_OUT',
}

export enum LunchpadOrderStatus {
  WAITING_FOR_TOKENS = 'WAITING_FOR_KAS',
  TOKENS_NOT_SENT = 'TOKENS_NOT_SENT',
  WAITING_FOR_PROCESSING = 'WAITING_FOR_PROCESSING',
  PROCESSING = 'PROCESSING',
  WAITING_FOR_LOW_FEE = 'WAITING_FOR_LOW_FEE',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}
