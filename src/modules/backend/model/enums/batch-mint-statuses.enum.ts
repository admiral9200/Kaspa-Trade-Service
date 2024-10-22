export enum BatchMintStatus {
  CREATED = 'CREATED_AND_WAITING_FOR_FEE',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED', // Temporary status when there are no units left, but orders are not yet final
  ERROR = 'ERROR',
}
