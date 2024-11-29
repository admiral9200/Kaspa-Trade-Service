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
import { WithdrawalHistoryDto } from '../model/dtos/withdrawals/withdrawal-history.dto';
import { WithdrawalTransformer } from '../transformers/withdrawal.transformer';
import { ListedWithdrawalDto } from '../model/dtos/withdrawals/listed-withdrawal.dto';
import { WalletAccount } from '../services/kaspa-network/interfaces/wallet-account.interface';

@Injectable()
export class WithdrawalProvider {
    constructor(
        private readonly kaspaFacade: KaspaFacade,
        private readonly p2pOrderBookService: P2pOrdersService,
        private readonly withdrawalService: WithdrawalsService,
        private readonly temporaryWalletService: TemporaryWalletSequenceService,
        private readonly kaspaNetworkActionsService: KaspaNetworkActionsService,
        private readonly telegramBotService: TelegramBotService,
        private readonly kaspianoBackendApiService: KaspianoBackendApiService,
        private readonly logger: AppLogger,
    ) { }

    async createWithdrawal(
        body: CreateWithdrawalDto,
        walletAddress: string
    ): Promise<Partial<WithdrawalResponseDto> | null> {
        try {
            const withdrawalOrder = await this.withdrawalService.createWithdrawal(body, walletAddress);

            const receivingWallet = body.receivingWallet;
            const requiredAmount = KaspaNetworkActionsService.KaspaToSompi(body.amount);

            // Getting private key...
            const sequenceId = await this.p2pOrderBookService.getOrderSequenceId(walletAddress);
            const masterWallet: WalletAccount = await this.kaspaNetworkActionsService.getWalletAccountAtIndex(sequenceId);

            const privateKey = masterWallet.privateKey.toKeypair().privateKey;

            const availableBalance = KaspaNetworkActionsService.KaspaToSompi(String(await this.p2pOrderBookService.getAvailableBalance(walletAddress)));

            if (withdrawalOrder.amount > availableBalance) {
                return {
                    success: false
                };
            }

            const totalBalance = await this.kaspaNetworkActionsService.fetchTotalBalanceForPublicWallet("05f31c6967afc6ca3745ea6cca68a132d609b085015d1cbfefec8ad80f30400a");

            if (totalBalance > availableBalance) {
                return await this.processKaspaTransfer("05f31c6967afc6ca3745ea6cca68a132d609b085015d1cbfefec8ad80f30400a", receivingWallet, requiredAmount, withdrawalOrder._id);
            } else {
                const withdrawal: WithdrawalEntity = await this.withdrawalService.updateWithdrawalStatusToWaitingForKas(withdrawalOrder._id);

                await this.telegramBotService.notifyWithdrawalWaitingForKas(withdrawal).catch(() => { });

                return WithdrawalResponseTransformer.transformEntityToResponseDto(
                    String(KaspaNetworkActionsService.KaspaToSompi(withdrawal.amount.toString())),
                    withdrawal.receivingWallet,
                    WithdrawalStatus.WAITING_FOR_KAS,
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

        const withdrawal = await this.withdrawalService.updateWithdrawalStatusToCompleted(id);

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


    async getWithdrawalHistory(
        getHistoryRequestDto: WithdrawalHistoryDto,
        walletAddress: string
    ): Promise<{ withdrawals: ListedWithdrawalDto[], totalCount: number }> {
        const { withdrawals, totalCount } = await this.withdrawalService.getWithdrawalHistory(getHistoryRequestDto, walletAddress);

        return {
            withdrawals: withdrawals.map((withdrawal) => WithdrawalTransformer.transformWithdrawalEntityToListedWithdrawalDto(withdrawal)),
            totalCount
        };
    }
}
