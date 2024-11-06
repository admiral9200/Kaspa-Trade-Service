import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PodJobProvider } from '../pod-job-provider';
import { isEmptyString } from '../../utils/object.utils';
import { AppConfigService } from 'src/modules/core/modules/config/app-config.service';
import { BatchMintService } from '../../services/batch-mint.service';
import { TelegramBotService } from 'src/modules/shared/telegram-notifier/services/telegram-bot.service';
import { KaspaNetworkActionsService } from '../../services/kaspa-network/kaspa-network-actions.service';

@Injectable()
export class BatchMintManagementProvider {
  constructor(
    private readonly podJobProvider: PodJobProvider,
    private readonly batchMintService: BatchMintService,
    private readonly config: AppConfigService,
    private readonly telegramBotService: TelegramBotService,
    private readonly kaspaNetworkActionsService: KaspaNetworkActionsService,
  ) {}

  async startBatchMintPod(id: string): Promise<void> {
    return await this.podJobProvider.startBatchMintingJob(id);
  }

  async getPrivateKey(id: string, password: string, viewerWallet: string) {
    if (isEmptyString(this.config.privateKeyViewingPassword)) {
      throw new UnauthorizedException();
    }

    if (this.config.privateKeyViewingPassword != password) {
      throw new UnauthorizedException();
    }

    const batchMint = await this.batchMintService.getById(id);

    await this.batchMintService.setWalletKeyExposedBy(batchMint, viewerWallet);

    const wallet = await this.kaspaNetworkActionsService.getWalletAccountAtIndex(batchMint.walletSequenceId);
    let message = TelegramBotService.escapeMarkdown(
      `\nA private key requested for batch mint: ${batchMint._id.toString()}\n\nAdmin wallet:\n${viewerWallet}\n\nPrivate key: ^^^PRIVATE^^^`,
    );

    message = message.replace('^^^PRIVATE^^^', TelegramBotService.formatCodeBlock(wallet.privateKey.toString()));

    await this.telegramBotService.sendFormattedMessage(this.config.getTelegramPrivateKeysChannelId, message);

    return { success: true };
  }
}
