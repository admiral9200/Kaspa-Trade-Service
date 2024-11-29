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
import { WithdrawalEntity } from '../model/schemas/withdrawal.schema';
import { WithdrawalHistoryDto } from '../model/dtos/withdrawals/withdrawal-history.dto';
import { WithdrawalTransformer } from '../transformers/withdrawal.transformer';
import { ListedWithdrawalDto } from '../model/dtos/withdrawals/listed-withdrawal.dto';
import { WalletAccount } from '../services/kaspa-network/interfaces/wallet-account.interface';
import { InvalidKaspaAmountForWithdrawalError } from '../services/kaspa-network/errors/InvalidKaspaAmountForWithdrawal';

@Injectable()
export class WithdrawalProvider {
    constructor(
        private readonly p2pOrderBookService: P2pOrdersService,
        private readonly withdrawalService: WithdrawalsService,
        private readonly kaspaNetworkActionsService: KaspaNetworkActionsService,
        private readonly telegramBotService: TelegramBotService,
        private readonly logger: AppLogger,
    ) { }

    async createWithdrawal(
        body: CreateWithdrawalDto,
        walletAddress: string
    ): Promise<Partial<WithdrawalResponseDto> | null> {
        try {
            const withdrawalOrder = await this.withdrawalService.createWithdrawal(body, walletAddress);

            const {receivingWallet, amount} = body;
            const requiredAmount = KaspaNetworkActionsService.KaspaToSompi(amount);

            const sequenceId = await this.p2pOrderBookService.getOrderSequenceId(walletAddress);
            
            const masterWallet: WalletAccount = await this.kaspaNetworkActionsService.getWalletAccountAtIndex(sequenceId);

            const privateKey = masterWallet.privateKey.toKeypair().privateKey;

            const availableBalance = KaspaNetworkActionsService.KaspaToSompi(String(await this.p2pOrderBookService.getAvailableBalance(walletAddress)));

            if (withdrawalOrder.amount > availableBalance) {
                return {
                    success: false
                };
            }

            const totalBalance = await this.kaspaNetworkActionsService.getWalletTotalBalance(masterWallet.address);

            if (totalBalance > availableBalance && requiredAmount <= availableBalance) {
                return await this.processKaspaTransfer(privateKey, receivingWallet, requiredAmount, withdrawalOrder._id);
            } else if(totalBalance > availableBalance && requiredAmount > availableBalance) {
                throw new Error('Required amount exceeds than your available balance!')
            } 
            else {
                const withdrawal: WithdrawalEntity = await this.withdrawalService.updateWithdrawalStatusToWaitingForKas(withdrawalOrder._id);

                const withdrawalError = new InvalidKaspaAmountForWithdrawalError(requiredAmount, availableBalance);
                await this.telegramBotService.sendErrorToErrorsChannel(withdrawalError);

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


    /**
     * Process the transfer in withdrawal.
     * @param privateKey 
     * @param receivingWallet 
     * @param availableBalance 
     * @param id 
     * @returns 
     */
    async processKaspaTransfer(
        privateKey: string,
        receivingWallet: string,
        amount: bigint,
        id: string
    ): Promise<Partial<WithdrawalResponseDto>> {
        try {
            if (!privateKey || !receivingWallet || !amount || !id) {
                throw new Error("Invalid parameters: privateKey, receivingWallet, amount, and id are required.");
            }

            await this.kaspaNetworkActionsService.transferKaspa(
                new PrivateKey(privateKey),
                [
                    {
                        address: receivingWallet,
                        amount: amount,
                    },
                ],
                1n
            );

            const withdrawal = await this.withdrawalService.updateWithdrawalStatusToCompleted(id);

            try {
                await this.telegramBotService.notifyWithdrawalCompleted(withdrawal);
            } catch (notifyError) {
                console.warn(`Failed to notify Telegram for withdrawal ID ${id}:`, notifyError.message);
            }

            return WithdrawalResponseTransformer.transformEntityToResponseDto(
                String(KaspaNetworkActionsService.KaspaToSompi(withdrawal.amount.toString())),
                withdrawal.receivingWallet,
                WithdrawalStatus.COMPLETED,
                withdrawal.createdAt,
                withdrawal.updatedAt,
                true
            );
        } catch (error) {
            console.error(`Error processing Kaspa transfer for withdrawal ID ${id}:`, error.message);
            throw error;
        }
    }


    /**
     * Getting withdrawal history with owner wallet address.
     * @param getHistoryRequestDto 
     * @param walletAddress 
     * @returns 
     */
    async getWithdrawalHistory(
        getHistoryRequestDto: WithdrawalHistoryDto,
        walletAddress: string
    ): Promise<{ withdrawals: ListedWithdrawalDto[]; totalCount: number }> {
        try {
            if (!walletAddress) {
                throw new Error("Wallet address is required to fetch withdrawal history.");
            }
    
            const { withdrawals, totalCount } = await this.withdrawalService.getWithdrawalHistory(
                getHistoryRequestDto,
                walletAddress
            );
    
            const transformedWithdrawals = withdrawals.map((withdrawal) =>
                WithdrawalTransformer.transformWithdrawalEntityToListedWithdrawalDto(withdrawal)
            );
    
            return {
                withdrawals: transformedWithdrawals,
                totalCount,
            };
        } catch (error) {
            console.error("Error fetching withdrawal history:", error.message);
            throw error;
        }
    }
    
}
