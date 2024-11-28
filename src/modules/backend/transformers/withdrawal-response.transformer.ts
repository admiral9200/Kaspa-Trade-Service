import { WithdrawalResponseDto } from "../model/dtos/withdrawals/withdrawal.response.dto";
import { WithdrawalStatus } from "../model/enums/withdrawal-status.enum";

export class WithdrawalResponseTransformer {
    static transformEntityToResponseDto(
        amount: string,
        receivingWallet: string,
        status: WithdrawalStatus,
        createdAt?: Date,
        updatedAt?: Date,
        success?: boolean
    ): Partial<WithdrawalResponseDto> {
        return {
            amount: amount,
            receivingWallet: receivingWallet,
            status: status,
            createdAt: createdAt,
            updatedAt: updatedAt,
            success: success
        };
    }
}