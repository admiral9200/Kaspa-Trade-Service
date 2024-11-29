import { CreateWithdrawalDto } from "../model/dtos/withdrawals/create-withdrawal.dto";
import { WithdrawalStatus } from "../model/enums/withdrawal-status.enum";
import { WithdrawalEntity } from "../model/schemas/p2p-withdrawal.schema";

export class WithdrawalTransformer {
    static createWithdrawalEntityFromWithdrawalDto(
        createWithdrawalDto: CreateWithdrawalDto
      ): WithdrawalEntity {
        return {
            amount: Number(createWithdrawalDto.amount),
            ownerWallet: createWithdrawalDto.ownerWallet,
            receivingWallet: createWithdrawalDto.receivingWallet,
            status: WithdrawalStatus.CREATED,
            createdAt: new Date(),
            updatedAt: new Date()
        };
      }
}