import { Injectable } from "@nestjs/common";
import { BaseRepository } from "./base.repository";
import { WithdrawalEntity } from "../model/schemas/withdrawal.schema";
import { InjectModel } from "@nestjs/mongoose";
import { MONGO_DATABASE_CONNECTIONS } from "../constants";
import { ClientSession, Model, Query } from "mongoose";
import { WithdrawalStatus } from "../model/enums/withdrawal-status.enum";
import { InvalidStatusForWithdrawalUpdateError } from "../services/kaspa-network/errors/InvalidStatusForWithdrawalUpdate";
import { WithdrawalHistoryDto } from "../model/dtos/withdrawals/withdrawal-history.dto";

@Injectable()
export class WithdrawalsRepository extends BaseRepository<WithdrawalEntity> {
    constructor(
        @InjectModel(WithdrawalEntity.name, MONGO_DATABASE_CONNECTIONS.P2P)
        private readonly withdrawalsModel: Model<WithdrawalEntity>
    ) {
        super(withdrawalsModel);
    }

    
    async createWithdrawalOrder(withdrawalOrder: WithdrawalEntity, session?: ClientSession): Promise<WithdrawalEntity> {
        return await super.create(withdrawalOrder, session);
      }


    async setWaitingForKasStatus(
        orderId: string,
        session?: ClientSession,
    ): Promise<WithdrawalEntity> {
        return await this.transitionOrderStatus(
            orderId,
            WithdrawalStatus.WAITING_FOR_KAS,
            WithdrawalStatus.CREATED,
            {},
            session,
        );
    }

    async setCompletedStatus(
        _id: string,
        transactionId?: string
    ): Promise<WithdrawalEntity> {
        return await this.transitionOrderStatus(
            _id,
            WithdrawalStatus.COMPLETED,
            WithdrawalStatus.CREATED,
            {transactionId: transactionId},
        )
    }

    async transitionOrderStatus(
        orderId: string,
        newStatus: WithdrawalStatus,
        requiredStatus: WithdrawalStatus,
        additionalData: Partial<WithdrawalEntity> = {},
        session?: ClientSession,
    ): Promise<WithdrawalEntity> {
        try {
            const order = await super.updateByOne(
                '_id',
                orderId,
                { status: newStatus, ...additionalData },
                { status: requiredStatus },
                session,
            );

            if (!order) {
                console.log('Failed assigning status, already in progress');
                throw new InvalidStatusForWithdrawalUpdateError(orderId);
            }

            return order;
        } catch (error) {
            if (!this.isDocumentTransactionLockedError(error)) {
                console.error(`Error updating to ${newStatus} for order by ID(${orderId}):`, error);
            }

            throw error;
        }
    }

    async getWithdrawalHistory(
        getWithdrawalRequestDto: WithdrawalHistoryDto,
        walletAddress: string
    ): Promise<{ withdrawals: WithdrawalEntity[], totalCount: number }> {
        try {
            const { sort, pagination } = getWithdrawalRequestDto;

            const baseQuery = { status: WithdrawalStatus.COMPLETED, ownerWallet: walletAddress };

            let query: any = this.withdrawalsModel.find(baseQuery);

            if(sort) {
                query = this.applySort(query, sort);
            }

            if(pagination) {
                query = this.applyPagination(query, pagination);
            }

            const totalCount = await this.withdrawalsModel.countDocuments(baseQuery);
            const withdrawals: WithdrawalEntity[] = await query.exec();

            return { totalCount, withdrawals } as any;
        } catch (error) {
            console.error('Error getting withdrawal history', error);
            throw error;
        }
    }

    
}