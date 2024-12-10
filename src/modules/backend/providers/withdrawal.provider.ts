import { Injectable } from '@nestjs/common';
import { KaspaFacade } from '../facades/kaspa.facade';
import { TelegramBotService } from 'src/modules/shared/telegram-notifier/services/telegram-bot.service';
import { AppLogger } from 'src/modules/core/modules/logger/app-logger.abstract';
import { CreateWithdrawalDto } from '../model/dtos/withdrawals/create-withdrawal.dto';
import { WithdrawalResponseDto } from '../model/dtos/withdrawals/withdrawal.response.dto';
import { PrivateKey } from 'libs/kaspa/kaspa';
import { WithdrawalResponseTransformer } from '../transformers/withdrawal-response.transformer';
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
    private readonly kaspaFacade: KaspaFacade,
    private readonly withdrawalService: WithdrawalsService,
    private readonly telegramBotService: TelegramBotService,
    private readonly logger: AppLogger,
  ) {}

  async createWithdrawal(body: CreateWithdrawalDto, walletAddress: string): Promise<Partial<WithdrawalResponseDto> | null> {
    try {
      const withdrawalOrder = await this.withdrawalService.createWithdrawal(body, walletAddress);

      const { receivingWallet, amount } = body;
      const requiredAmount = this.kaspaFacade.convertFromKaspaToSompi(amount);

      const withdrawalWallet: WalletAccount = await this.kaspaFacade.retrieveWithdrawalWalletAccountAtIndex(0);

      const { totalBalance } = await this.kaspaFacade.getWalletTotalBalanceAndUtxos(withdrawalWallet.address);

      if (requiredAmount > totalBalance) {
        const withdrawal: WithdrawalEntity = await this.withdrawalService.updateWithdrawalStatusToWaitingForKas(
          withdrawalOrder._id,
        );

        const withdrawalError = new InvalidKaspaAmountForWithdrawalError(requiredAmount, totalBalance);
        await this.telegramBotService.sendErrorToErrorsChannel(withdrawalError);

        return WithdrawalResponseTransformer.transformEntityToResponseDto(
          String(this.kaspaFacade.convertFromKaspaToSompi(withdrawal.amount.toString())),
          withdrawal.receivingWallet,
          withdrawal.status,
          withdrawal.createdAt,
          withdrawal.updatedAt,
          false,
        );
      }

      return await this.processKaspaTransfer(withdrawalWallet.privateKey, receivingWallet, requiredAmount, withdrawalOrder._id);
    } catch (error) {
      console.log('error: ', error);
      this.logger.error(error);
    }
  }

  /**
   * Process the transfer in withdrawal.
   * @param privateKey
   * @param receivingWallet
   * @param maxKaspa
   * @param id
   * @returns
   */
  async processKaspaTransfer(
    privateKey: PrivateKey,
    receivingWallet: string,
    amount: bigint,
    id: string,
  ): Promise<Partial<WithdrawalResponseDto>> {
    try {
      if (!privateKey || !receivingWallet || !amount || !id) {
        throw new Error('Invalid parameters: privateKey, receivingWallet, amount, and id are required.');
      }
      let transactionId: string = null;

      const result = await this.kaspaFacade.doKaspaTransferForWithdrawal(privateKey, 1n, receivingWallet, amount);

      if (result) {
        transactionId = result.transactions[0].id;
      }

      const withdrawal = await this.withdrawalService.updateWithdrawalStatusToCompleted(id, transactionId);

      try {
        await this.telegramBotService.notifyWithdrawalCompleted(withdrawal);
      } catch (notifyError) {
        console.warn(`Failed to notify Telegram for withdrawal ID ${id}:`, notifyError.message);
      }

      return WithdrawalResponseTransformer.transformEntityToResponseDto(
        String(this.kaspaFacade.convertFromKaspaToSompi(withdrawal.amount.toString())),
        withdrawal.receivingWallet,
        withdrawal.status,
        withdrawal.createdAt,
        withdrawal.updatedAt,
        true,
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
    walletAddress: string,
  ): Promise<{ withdrawals: ListedWithdrawalDto[]; totalCount: number }> {
    try {
      if (!walletAddress) {
        throw new Error('Wallet address is required to fetch withdrawal history.');
      }

      const { withdrawals, totalCount } = await this.withdrawalService.getWithdrawalHistory(getHistoryRequestDto, walletAddress);

      const transformedWithdrawals = withdrawals.map((withdrawal) =>
        WithdrawalTransformer.transformWithdrawalEntityToListedWithdrawalDto(withdrawal),
      );

      return {
        withdrawals: transformedWithdrawals,
        totalCount,
      };
    } catch (error) {
      console.error('Error fetching withdrawal history:', error.message);
      throw error;
    }
  }
}
