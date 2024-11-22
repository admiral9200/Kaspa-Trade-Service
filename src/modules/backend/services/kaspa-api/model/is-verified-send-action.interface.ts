export interface IsVerifiedSendAction {
  isVerified: boolean;
  isCompleted?: boolean;
  buyerWalletAddress?: string;
  commission?: bigint;
}
