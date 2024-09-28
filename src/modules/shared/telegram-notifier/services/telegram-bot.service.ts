import { AppConfigService } from '../../../core/modules/config/app-config.service';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { Injectable } from '@nestjs/common';

@Injectable()
export class TelegramBotService {
  protected apiKey: string;
  protected baseUrl: string = 'https://api.telegram.org/bot';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: AppConfigService,
  ) {
    this.apiKey = this.configService.getTelegramBotApiKey;
    if (!this.apiKey) {
      throw new Error('TELEGRAM_BOT_API_KEY is not defined in the environment');
    }
  }

  async sendFormattedMessage(channelId: string, message: string): Promise<void> {
    const url = `${this.baseUrl}${this.apiKey}/sendMessage`;
    const data = {
      chat_id: channelId,
      text: message,
      parse_mode: 'MarkdownV2',
    };

    try {
      const response = await lastValueFrom(this.httpService.post(url, data));
      if (response.status === 200) {
        console.log('Formatted message sent successfully');
      } else {
        throw new Error('Failed to send formatted message');
      }
    } catch (error) {
      console.error('Error sending formatted message:', error);
      throw new Error('Failed to send formatted message');
    }
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
