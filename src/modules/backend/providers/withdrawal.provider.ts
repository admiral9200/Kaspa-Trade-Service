import { Injectable } from '@nestjs/common';
import { P2pOrdersService } from '../services/p2p-orders.service';
import { KaspaNetworkActionsService } from '../services/kaspa-network/kaspa-network-actions.service';
import { KaspaFacade } from '../facades/kaspa.facade';
import { TemporaryWalletSequenceService } from '../services/temporary-wallet-sequence.service';
import { TelegramBotService } from 'src/modules/shared/telegram-notifier/services/telegram-bot.service';
import { AppLogger } from 'src/modules/core/modules/logger/app-logger.abstract';
import { KaspianoBackendApiService } from '../services/kaspiano-backend-api/services/kaspiano-backend-api.service';
import { CreateWithdrawalDto } from '../model/dtos/withdrawals/create-withdrawal.dto';
import { WithdrawalResponseDto } from '../model/dtos/withdrawals/withdrawal.response.dto';
import { PrivateKey } from 'libs/kaspa/kaspa';
import { WithdrawalResponseTransformer } from '../transformers/withdrawal-response.transformer';
import { WithdrawalStatus } from '../model/enums/withdrawal-status.enum';
import { WithdrawalsService } from '../services/withdrawals.service';
import { WithdrawalEntity } from '../model/schemas/p2p-withdrawal.schema';

@Injectable()
export class WithdrawalProvider {
    constructor(
        private readonly kaspaFacade: KaspaFacade,
        private readonly p2pOrderBookService: P2pOrdersService,
        private readonly p2pWithdrawalBookService: WithdrawalsService,
        private readonly temporaryWalletService: TemporaryWalletSequenceService,
        private readonly kaspaNetworkActionsService: KaspaNetworkActionsService,
        private readonly telegramBotService: TelegramBotService,
        private readonly kaspianoBackendApiService: KaspianoBackendApiService,
        private readonly logger: AppLogger,
    ) { }

    async createWithdrawal(body: CreateWithdrawalDto): Promise<Partial<WithdrawalResponseDto> | null> {
        try {
            const withdrawalOrder = await this.p2pWithdrawalBookService.createWithdrawal(body);

            const receivingWallet = body.receivingWallet;
            const requiredBalance = KaspaNetworkActionsService.KaspaToSompi(body.amount);
            const privateKey = body.ownerWallet;
            const availableBalance = KaspaNetworkActionsService.KaspaToSompi(String(await this.p2pOrderBookService.getAvailableBalance(receivingWallet)));

            if (withdrawalOrder.amount > availableBalance) {
                return {
                    success: false
                };
            }

            const totalBalance = await this.kaspaNetworkActionsService.fetchTotalBalanceForPublicWallet(privateKey);

            if (totalBalance > availableBalance) {
                return await this.processKaspaTransfer(privateKey, receivingWallet, requiredBalance, withdrawalOrder._id);
            } else {
                const withdrawal: WithdrawalEntity = await this.p2pWithdrawalBookService.updateWithdrawalStatusToWaitingForKas(withdrawalOrder._id);

                return WithdrawalResponseTransformer.transformEntityToResponseDto(
                    String(KaspaNetworkActionsService.KaspaToSompi(withdrawal.amount.toString())),
                    withdrawal.receivingWallet,
                    WithdrawalStatus.COMPLETED,
                    withdrawal.createdAt,
                    withdrawal.updatedAt,
                    false
                );
            }
        } catch (error) {
            console.log("error: ", error);
            this.logger.error(error);
        }
    }

    // Consider: This should be service?
    async processKaspaTransfer(privateKey: string, receivingWallet: string, availableBalance: bigint, id: string): Promise<Partial<WithdrawalResponseDto>> {
        await this.kaspaNetworkActionsService.transferKaspa(
            new PrivateKey(privateKey),
            [{
                address: receivingWallet,
                amount: availableBalance,
            }],
            1n
        );

        const withdrawal = await this.p2pWithdrawalBookService.updateWithdrawalStatusToCompleted(id);

        await this.telegramBotService.notifyWithdrawalCompleted(withdrawal).catch(() => { });

        return WithdrawalResponseTransformer.transformEntityToResponseDto(
            String(KaspaNetworkActionsService.KaspaToSompi(withdrawal.amount.toString())),
            withdrawal.receivingWallet,
            WithdrawalStatus.COMPLETED,
            withdrawal.createdAt,
            withdrawal.updatedAt,
            true
        );
    }


    async getWithdrawalHistory(walletAddress: string) {

    }
}
