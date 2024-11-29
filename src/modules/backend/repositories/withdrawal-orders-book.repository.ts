import { Injectable } from "@nestjs/common";
import { BaseRepository } from "./base.repository";
import { WithdrawalEntity } from "../model/schemas/p2p-withdrawal.schema";
import { InjectModel } from "@nestjs/mongoose";
import { MONGO_DATABASE_CONNECTIONS } from "../constants";
import { ClientSession, Model } from "mongoose";
import { WithdrawalStatus } from "../model/enums/withdrawal-status.enum";
import { InvalidStatusForOrderUpdateError } from "../services/kaspa-network/errors/InvalidStatusForOrderUpdate";

@Injectable()
export class WithdrawalOrdersBookRepository extends BaseRepository<WithdrawalEntity> {
    constructor(
        @InjectModel(WithdrawalEntity.name, MONGO_DATABASE_CONNECTIONS.P2P)
        private readonly withdrawalOrdersModel: Model<WithdrawalEntity>
    ) {
        super(withdrawalOrdersModel);
    }

    
    async createWithdrawalOrder(withdrawalOrder: WithdrawalEntity, session?: ClientSession): Promise<WithdrawalEntity> {
        try {
          return await super.create(withdrawalOrder, session);
        } catch (error) {
          console.error('Error creating sell order:', error);
          throw error;
        }
      }


    async setWaitingForKasStatus(
        orderId: string,
        session?: ClientSession,
        fromExpired: boolean = false,
    ): Promise<WithdrawalEntity> {
        return await this.transitionOrderStatus(
            orderId,
            WithdrawalStatus.WAITING_FOR_KAS,
            fromExpired ? WithdrawalStatus.IN_PROGRESS : WithdrawalStatus.IN_PROGRESS,
            {},
            session,
        );
    }

    async setCompletedStatus(
        _id: string,
        session?: ClientSession,
        fromExpired: boolean = false,
    ): Promise<WithdrawalEntity> {
        return await this.transitionOrderStatus(
            _id,
            WithdrawalStatus.COMPLETED,
            fromExpired ? WithdrawalStatus.CREATED : WithdrawalStatus.CREATED,
            {},
            session,
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
                throw new InvalidStatusForOrderUpdateError();
            }

            return order;
        } catch (error) {
            if (!this.isDocumentTransactionLockedError(error)) {
                console.error(`Error updating to ${newStatus} for order by ID(${orderId}):`, error);
            }

            throw error;
        }
    }
}