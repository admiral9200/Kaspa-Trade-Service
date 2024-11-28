export enum LunchpadStatus {
  INACTIVE = 'INACTIVE',
  ACTIVE = 'ACTIVE',
  NO_UNITS_LEFT = 'NO_UNITS_LEFT', // Temporary status when there are no units left, but orders are not yet final
  SOLD_OUT = 'SOLD_OUT',
  STOPPING = 'STOPPING',
}

export enum LunchpadOrderStatus {
  WAITING_FOR_KAS = 'WAITING_FOR_KAS',
  TOKENS_NOT_SENT = 'TOKENS_NOT_SENT',
  VERIFIED_AND_WAITING_FOR_PROCESSING = 'VERIFIED_AND_WAITING_FOR_PROCESSING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}
