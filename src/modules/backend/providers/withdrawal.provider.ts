import { Injectable} from '@nestjs/common';
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
import { P2pWithdrawalBookResponseTransformer } from '../transformers/p2p-withdrawal-book-response.transformer';
import { WithdrawalStatus } from '../model/enums/withdrawal-status.enum';
import { P2pWithdrawalsService } from '../services/p2p-withdrawals.service';
import { P2pWithdrawalEntity } from '../model/schemas/p2p-withdrawal.schema';

@Injectable()
export class WithdrawalProvider {
  constructor(
    private readonly kaspaFacade: KaspaFacade,
    private readonly p2pOrderBookService: P2pOrdersService,
    private readonly p2pWithdrawalBookService: P2pWithdrawalsService,
    private readonly temporaryWalletService: TemporaryWalletSequenceService,
    private readonly kaspaNetworkActionsService: KaspaNetworkActionsService,
    private readonly telegramBotService: TelegramBotService,
    private readonly kaspianoBackendApiService: KaspianoBackendApiService,
    private readonly logger: AppLogger,
  ) {}

  async createWithdrawal(body: CreateWithdrawalDto): Promise<Partial<WithdrawalResponseDto> | null> {
    try {
      // Create withdrawal order with CREATED status...
      const withdrawalOrder = await this.p2pWithdrawalBookService.createWithdrawal(body);
      
      // Getting available balance for users...
      const receivingWallet = body.receivingWallet;
      const privateKey = body.ownerWallet;
      const availableBalance = await this.p2pOrderBookService.getAvailableBalance(receivingWallet);


      // Check if the amount of withdrawal order amount is okay...
      if(withdrawalOrder.amount > availableBalance) {
        return {
          success: false
        };
      }

      // Getting total balance of master wallet...
      const totalBalance = await this.kaspaNetworkActionsService.fetchTotalBalanceForPublicWallet(privateKey);

      // Compare with the total balance and available balance of user...
      if (totalBalance > BigInt(availableBalance) * BigInt(10 ** 8)) {
        const result = await this.kaspaNetworkActionsService.transferKaspa(
          new PrivateKey(privateKey),
          [{
            address: receivingWallet,
            amount: BigInt(availableBalance) * BigInt(10 ** 8)
          }],
          1n
        );

        // Update the status of withdrawal order to COMPLETED...
        const withdrawal: P2pWithdrawalEntity = await this.p2pWithdrawalBookService.updateWithdrawalStatusToCompleted(withdrawalOrder._id);

        // Notify the completed status to Telegram.
        await this.telegramBotService.notifyWithdrawalCompleted(withdrawal).catch(() => {});

        // Mapping to response DTO.
        return P2pWithdrawalBookResponseTransformer.transformEntityToResponseDto(
          String(BigInt(withdrawal.amount) * BigInt(10 ** 8)),
          withdrawal.receivingWallet,
          WithdrawalStatus.COMPLETED,
          withdrawal.createdAt,
          withdrawal.updatedAt,
          true
        );

      } else {
        // When there is no enough balance in the master wallet...
        // This should be WAITING_FOR_KAS status.
        const withdrawal: P2pWithdrawalEntity = await this.p2pWithdrawalBookService.updateWithdrawalStatusToWaitingForKas(withdrawalOrder._id);

        // Mapping to response DTO.
        return P2pWithdrawalBookResponseTransformer.transformEntityToResponseDto(
          String(BigInt(withdrawal.amount) * BigInt(10 ** 8)),
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
}
