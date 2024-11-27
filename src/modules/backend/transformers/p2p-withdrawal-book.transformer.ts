import { CreateWithdrawalDto } from "../model/dtos/p2p-withdrawals/create-withdrawal.dto";
import { WithdrawalStatus } from "../model/enums/withdrawal-status.enum";
import { P2pWithdrawalEntity } from "../model/schemas/p2p-withdrawal.schema";

export class P2pWithdrawalBookTransformer {
    static createP2pWithdrawalEntityFromWithdrawalDto(
        createWithdrawalDto: CreateWithdrawalDto
      ): P2pWithdrawalEntity {
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