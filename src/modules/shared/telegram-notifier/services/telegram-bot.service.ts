import { AppConfigService } from '../../../core/modules/config/app-config.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Inject, Injectable } from '@nestjs/common';
import { AppLogger } from 'src/modules/core/modules/logger/app-logger.abstract';
import { P2pOrderEntity } from 'src/modules/backend/model/schemas/p2p-order.schema';
import { isEmptyString } from 'src/modules/backend/utils/object.utils';
import { MIMINAL_COMMITION } from 'src/modules/backend/services/kaspa-network/kaspa-network-actions.service';
import { BatchMintEntity } from 'src/modules/backend/model/schemas/batch-mint.schema';
import { P2pOrderV2Entity } from 'src/modules/backend/model/schemas/p2p-order-v2.schema';

const MAX_MESSAGE_LENGTH = 4096;

@Injectable()
export class TelegramBotService {
  protected apiKey: string;
  protected optionalNotificationApiKey: string;
  protected baseUrl: string = 'https://api.telegram.org/bot';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: AppConfigService,
    @Inject(AppLogger) private readonly logger: AppLogger,
  ) {
    this.apiKey = this.configService.getTelegramBotApiKey;
    this.optionalNotificationApiKey = this.configService.getTelegramOptionalBotApiKey;

    if (!this.apiKey) {
      throw new Error('TELEGRAM_BOT_API_KEY is not defined in the environment');
    }
  }

  async sendFormattedMessage(channelId: string, message: string, apiKey?: string): Promise<void> {
    const url = `${this.baseUrl}${apiKey || this.apiKey}/sendMessage`;
    const envTag = `[${this.configService.isProduction ? 'PROD' : 'DEV'}]`;
    const text = `${envTag} \\- ${message}`;

    const splittedText =
      text.length > MAX_MESSAGE_LENGTH ? text.match(new RegExp('.{1,' + MAX_MESSAGE_LENGTH + '}', 'gs')) : [text];

    for (const currentText of splittedText) {
      const data = {
        chat_id: channelId,
        text: currentText,
        parse_mode: 'MarkdownV2',
      };

      try {
        const response = await firstValueFrom(this.httpService.post(url, data));

        if (response.status === 200) {
          console.log('Formatted message sent successfully');
        } else {
          throw new Error('Failed to send formatted message');
        }
      } catch (error) {
        console.error('Error sending formatted message:', error);
        this.logger.error('Error sending formatted message: ' + JSON.stringify(error));
        throw new Error('Failed to send formatted message');
      }
    }
  }

  async sendError(channelId: string, error: any, skipStack = false): Promise<void> {
    try {
      const stackText = skipStack ? '' : `**__Stack:__** ${TelegramBotService.escapeMarkdown(error?.stack || '')}, \n`;
      const message = `Error:\n**__Name:__** ${TelegramBotService.escapeMarkdown(error?.name || '')}\n**__Message:__** ${TelegramBotService.escapeMarkdown(error?.message || error.toString())}\n${stackText}**__additionalData:__** ${TelegramBotService.escapeMarkdown(
        JSON.stringify(error, (key, value) => (typeof value === 'bigint' ? value.toString() + 'n' : value)),
      )}`;

      return await this.sendFormattedMessage(channelId, message);
    } catch (error) {
      console.error('Error sending error message:', error);
      this.logger.error('Error sending error message: ' + JSON.stringify(error));
    }
  }

  async notifyOrderCompleted(order: P2pOrderEntity | P2pOrderV2Entity, isNew = false): Promise<void> {
    if (
      !isEmptyString(this.optionalNotificationApiKey) &&
      !isEmptyString(this.configService.getTelegramOrdersNotificationsChannelId)
    ) {
      try {
        let comission = ((order as P2pOrderV2Entity).feeAmount || 0).toFixed(3);

        if (!isNew) {
          comission = Math.max(
            order.totalPrice * (this.configService.swapCommissionPercentage / 100),
            Number(MIMINAL_COMMITION) / 1e8,
          ).toFixed(3);
        }

        let message = TelegramBotService.escapeMarkdown(
          `Order completed.^n^Total Kaspa: ${order.totalPrice}^n^Tokens: ${order.quantity} ${order.ticker}^n^Commission: ${comission}`,
        );

        message = message.replace(/\^n\^/g, '\n');

        await this.sendFormattedMessage(
          this.configService.getTelegramOrdersNotificationsChannelId,
          message,
          this.optionalNotificationApiKey,
        );
      } catch (error) {
        console.error('Error notifying order completed:', error);
        this.logger.error('Error notifying order completed');
        this.logger.error(error, error?.stack, error?.meta);
      }
    }
  }

  async notifyBatchMintCompleted(batchMint: BatchMintEntity, commission: number): Promise<void> {
    if (
      !isEmptyString(this.optionalNotificationApiKey) &&
      !isEmptyString(this.configService.getTelegramOrdersNotificationsChannelId)
    ) {
      try {
        const statusText = batchMint.isReachedMintLimit
          ? `Reached Mint Limit (${batchMint.stopMintsAtMintsLeft})`
          : batchMint.isUserCanceled
            ? 'User Canceled'
            : 'Completed Successfully';
        let message = TelegramBotService.escapeMarkdown(
          `Btach mint completed.^n^Ticker: ${batchMint.ticker}^n^Mints: ${batchMint.finishedMints}/${batchMint.totalMints}^n^Status: ${statusText}^n^Commission: ${commission.toFixed(3)}`,
        );

        message = message.replace(/\^n\^/g, '\n');

        await this.sendFormattedMessage(
          this.configService.getTelegramOrdersNotificationsChannelId,
          message,
          this.optionalNotificationApiKey,
        );
      } catch (error) {
        console.error('Error notifying batch mint completed:', error);
        this.logger.error('Error notifying batch mint completed');
        this.logger.error(error, error?.stack, error?.meta);
      }
    }
  }

  async sendErrorToErrorsChannel(error: any, skipStack = false): Promise<void> {
    return await this.sendError(this.configService.getTelegramErrorsChannelId, error, skipStack);
  }

  static escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
  }

  static formatCodeBlock(code: string, language?: string): string {
    const escapedCode = TelegramBotService.escapeMarkdown(code);
    if (language) {
      return `\`\`\`${language}\n${escapedCode}\n\`\`\``;
    }
    return `\`\`\`\n${escapedCode}\n\`\`\``;
  }
}
