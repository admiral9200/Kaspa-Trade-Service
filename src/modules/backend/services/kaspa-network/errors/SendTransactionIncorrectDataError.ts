import { IKaspaApiTransactionData } from '../../kaspa-api/model/kaspa-api-transaction-data.interface';

export class SendTransactionIncorrectDataError extends Error {
  constructor(
    txnInfo: IKaspaApiTransactionData,
    txnId: string,
    sellerWalletAddress: string,
    sellerPsktTransactionId: string,
    amount: bigint,
  ) {
    super(
      `Send transaction incorrect data. txnId: ${txnId} sellerWalletAddress: ${sellerWalletAddress} sellerPsktTransactionId: ${sellerPsktTransactionId} amount: ${amount}`,
    );
    this.name = 'SendTransactionIncorrectDataError';
  }
}
