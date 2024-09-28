import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TelegramBotService } from './services/telegram-bot.service';

@Module({
  imports: [HttpModule],
  providers: [TelegramBotService],
  exports: [TelegramBotService],
})
export class TelegramNotifierModule {}
