import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { MONGO_DATABASE_CONNECTIONS } from "../constants";
import { Connection } from "mongoose";
import { WithdrawalsRepository } from "../repositories/withdrawal-orders.repository";
import { CreateWithdrawalDto } from "../model/dtos/withdrawals/create-withdrawal.dto";
import { WithdrawalEntity } from "../model/schemas/p2p-withdrawal.schema";
import { WithdrawalTransformer } from "../transformers/withdrawal.transformer";
import { WithdrawalHistoryDto } from "../model/dtos/withdrawals/withdrawal-history.dto";
import { WithdrawalDm } from "../model/dms/withdrawal.dm";

@Injectable()
export class WithdrawalsService {
    constructor(
        @InjectConnection(MONGO_DATABASE_CONNECTIONS.P2P) private connection: Connection,
        private readonly withdrawalsRepository: WithdrawalsRepository
    ) { }

    public async createWithdrawal(
        createWithdrawalDto: CreateWithdrawalDto,
        walletAddress: string
    ): Promise<WithdrawalEntity> {
        try {
            const withdrawalOrder: WithdrawalEntity = WithdrawalTransformer.createWithdrawalEntityFromWithdrawalDto(createWithdrawalDto, walletAddress);

            return await this.withdrawalsRepository.createWithdrawalOrder(withdrawalOrder);
        } catch (error) {
            throw new HttpException('Failed to create a new withdrawal order', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async updateWithdrawalStatusToCompleted(_id: string): Promise<WithdrawalEntity> {
        const order: WithdrawalEntity = await this.withdrawalsRepository.setCompletedStatus(_id);

        if (!order) {
            throw new HttpException('Withdrawal order is not in the matching status.', HttpStatus.INTERNAL_SERVER_ERROR);
        }

        return order;
    }

    async updateWithdrawalStatusToWaitingForKas(_id: string): Promise<WithdrawalEntity> {
        const order: WithdrawalEntity = await this.withdrawalsRepository.setWaitingForKasStatus(_id);

        if (!order) {
            throw new HttpException('Withdrawal order is not in the matching status.', HttpStatus.INTERNAL_SERVER_ERROR);
        }

        return order;
    }

    async getWithdrawalHistory(
        getHistoryRequestDto: WithdrawalHistoryDto,
        walletAddress: string
    ): Promise<{ withdrawals: WithdrawalDm[], totalCount: number }> {
        return await this.withdrawalsRepository.getWithdrawalHistory(getHistoryRequestDto, walletAddress);
    }
}