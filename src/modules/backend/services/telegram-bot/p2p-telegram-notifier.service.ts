import { Injectable } from '@nestjs/common';
import { TelegramBotService } from '../../../shared/telegram-notifier/services/telegram-bot.service';
import { AppConfigService } from '../../../core/modules/config/app-config.service';

type MessageType = 'info' | 'error' | 'warning' | 'success';

@Injectable()
export class P2pTelegramNotifierService {
  private readonly RUN_ON_PRODUCTION_ONLY = false;
  private readonly SERVICE_NAME = 'P2P Service';

  constructor(
    private readonly configService: AppConfigService,
    private readonly telegramBotService: TelegramBotService,
  ) {}

  async sendMessage(type: MessageType, title: string, message?: string): Promise<void> {
    if (!this.canSendMessages()) {
      return;
    }

    const channelId: string = this.configService.getTelegramErrorsChannelId();

    const icon = this.getIconForType(type);
    const messageHeader = `${icon} [${this.SERVICE_NAME}] ${icon}\n`;
    const formattedTitle = `*${TelegramBotService.escapeMarkdown(title)}*`;
    const detailsMessage = message ? `\n*Details:*\n${TelegramBotService.formatCodeBlock(message)}` : '';

    const fullMessage = `${messageHeader}${formattedTitle}${detailsMessage}`;

    await this.telegramBotService.sendFormattedMessage(channelId, fullMessage);
  }

  async sendInfo(title: string, message?: string): Promise<void> {
    await this.sendMessage('info', title, message);
  }

  async sendError(title: string, message?: string): Promise<void> {
    await this.sendMessage('error', title, message);
  }

  async sendWarning(title: string, message?: string): Promise<void> {
    await this.sendMessage('warning', title, message);
  }

  async sendSuccess(title: string, message?: string): Promise<void> {
    await this.sendMessage('success', title, message);
  }

  private canSendMessages(): boolean {
    return this.configService.isProduction || !this.RUN_ON_PRODUCTION_ONLY;
  }

  private getIconForType(type: MessageType): string {
    const icons = {
      info: 'ℹ️',
      error: '🚫',
      warning: '⚠️',
      success: '✅',
    };
    return icons[type];
  }
}
