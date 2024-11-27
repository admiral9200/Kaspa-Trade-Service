import { WithdrawalResponseDto } from "../model/dtos/p2p-withdrawals/withdrawal.response.dto";
import { WithdrawalStatus } from "../model/enums/withdrawal-status.enum";

export class P2pWithdrawalBookResponseTransformer {
    static transformEntityToResponseDto(amount: bigint, receivingWallet: string, status: WithdrawalStatus): Partial<WithdrawalResponseDto> {
        return {
            amount: amount,
            receivingWallet: receivingWallet,
            status: status
        };
    }
}