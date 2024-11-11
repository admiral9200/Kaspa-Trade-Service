import { Injectable, UnauthorizedException } from '@nestjs/common';
import { isEmptyString } from '../../utils/object.utils';
import { AppConfigService } from 'src/modules/core/modules/config/app-config.service';
import { TelegramBotService } from 'src/modules/shared/telegram-notifier/services/telegram-bot.service';
import { KaspaNetworkActionsService } from '../../services/kaspa-network/kaspa-network-actions.service';
import { LunchpadProvider } from '../lunchpad.provider';
import { LunchpadService } from '../../services/lunchpad.service';

@Injectable()
export class LunchpadManagementProvider {
  constructor(
    private readonly lunchpadProvider: LunchpadProvider,
    private readonly lunchpadService: LunchpadService,
    private readonly config: AppConfigService,
    private readonly telegramBotService: TelegramBotService,
    private readonly kaspaNetworkActionsService: KaspaNetworkActionsService,
  ) {}

  async startLunchpadProcess(id: string): Promise<void> {
    const lunchpad = await this.lunchpadService.getById(id);
    return await this.lunchpadProvider.startLunchpadProcessingOrdersIfNeeded(lunchpad);
  }

  async getPrivateKey(id: string, password: string, walletType: string, viewerWallet: string) {
    if (isEmptyString(this.config.privateKeyViewingPassword)) {
      throw new UnauthorizedException();
    }

    if (this.config.privateKeyViewingPassword != password) {
      throw new UnauthorizedException();
    }

    const batchMint = await this.lunchpadService.getById(id);

    let walletSequenceId = null;

    if (walletType == 'reciver') {
      walletSequenceId = batchMint.receiverWalletSequenceId;
    } else if (walletType == 'sender') {
      walletSequenceId = batchMint.senderWalletSequenceId;
    } else {
      throw new Error('Wallet not found');
    }

    const wallet = await this.kaspaNetworkActionsService.getWalletAccountAtIndex(walletSequenceId);
    await this.lunchpadService.setWalletKeyExposedBy(batchMint, viewerWallet, walletType);

    let message = TelegramBotService.escapeMarkdown(
      `\nA private key requested for lunchpad ${wallet} wallet: ${batchMint._id.toString()}\n\nAdmin wallet:\n${viewerWallet}\n\nPrivate key: ^^^PRIVATE^^^`,
    );

    message = message.replace('^^^PRIVATE^^^', TelegramBotService.formatCodeBlock(wallet.privateKey.toString()));

    await this.telegramBotService.sendFormattedMessage(this.config.getTelegramPrivateKeysChannelId, message);

    return { success: true };
  }
}
