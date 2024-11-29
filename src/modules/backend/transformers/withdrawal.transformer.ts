import { CreateWithdrawalDto } from "../model/dtos/withdrawals/create-withdrawal.dto";
import { ListedWithdrawalDto } from "../model/dtos/withdrawals/listed-withdrawal.dto";
import { WithdrawalStatus } from "../model/enums/withdrawal-status.enum";
import { WithdrawalEntity } from "../model/schemas/withdrawal.schema";

export class WithdrawalTransformer {
  static transformWithdrawalEntityToListedWithdrawalDto(entity: WithdrawalEntity): ListedWithdrawalDto {
    return {
      withdrawalId: entity._id,
      amount: entity.amount,
      ownerWallet: entity.ownerWallet,
      receivingWallet: entity.receivingWallet,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      status: entity.status,
      transactionId: entity.transactionId
    };
  }

    static createWithdrawalEntityFromWithdrawalDto(
        createWithdrawalDto: CreateWithdrawalDto,
        walletAddress: string
      ): WithdrawalEntity {
        return {
            amount: Number(createWithdrawalDto.amount),
            ownerWallet: walletAddress,
            receivingWallet: createWithdrawalDto.receivingWallet,
            status: WithdrawalStatus.CREATED,
            transactionId: null,
            createdAt: new Date(),
            updatedAt: new Date()
        };
      }
}