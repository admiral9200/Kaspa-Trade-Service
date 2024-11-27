import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { MONGO_DATABASE_CONNECTIONS } from "../constants";
import { Connection } from "mongoose";
import { WithdrawalOrdersBookRepository } from "../repositories/withdrawal-orders-book.repository";
import { CreateWithdrawalDto } from "../model/dtos/p2p-withdrawals/create-withdrawal.dto";
import { P2pWithdrawalEntity } from "../model/schemas/p2p-withdrawal.schema";
import { P2pWithdrawalBookTransformer } from "../transformers/p2p-withdrawal-book.transformer";

@Injectable()
export class P2pWithdrawalsService {
    constructor(
        @InjectConnection(MONGO_DATABASE_CONNECTIONS.P2P) private connection: Connection,
        private readonly withdrawalOrdersBookRepository: WithdrawalOrdersBookRepository
    ) { }

    public async createWithdrawal(
        createWithdrawalDto: CreateWithdrawalDto,
    ): Promise<P2pWithdrawalEntity> {
        try {
            const withdrawalOrder: P2pWithdrawalEntity = P2pWithdrawalBookTransformer.createP2pWithdrawalEntityFromWithdrawalDto(createWithdrawalDto);

            return await this.withdrawalOrdersBookRepository.createWithdrawalOrder(withdrawalOrder);
        } catch (error) {
            throw new HttpException('Failed to create a new withdrawal order', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async updateWithdrawalStatusToCompleted(_id: string): Promise<P2pWithdrawalEntity> {
        const order: P2pWithdrawalEntity = await this.withdrawalOrdersBookRepository.setCompletedStatus(_id);

        if (!order) {
            throw new HttpException('Withdrawal order is not in the matching status.', HttpStatus.INTERNAL_SERVER_ERROR);
        }

        return order;
    }

    async updateWithdrawalStatusToWaitingForKas(_id: string): Promise<P2pWithdrawalEntity> {
        const order: P2pWithdrawalEntity = await this.withdrawalOrdersBookRepository.setWaitingForKasStatus(_id);

        if (!order) {
            throw new HttpException('Withdrawal order is not in the matching status.', HttpStatus.INTERNAL_SERVER_ERROR);
        }

        return order;
    }
}