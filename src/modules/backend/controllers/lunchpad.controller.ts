import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { WalletGuard } from '../guards/wallet.guard';
import { AppLogger } from 'src/modules/core/modules/logger/app-logger.abstract';
import { CreateLunchpadRequestDto, CreateLunchpadResponseDto } from '../model/dtos/lunchpad/create-lunchpad.dto';
import { LunchpadProvider } from '../providers/lunchpad.provider';

@Controller('lunchpad')
@UseGuards(WalletGuard)
export class LunchpadController {
  constructor(
    private readonly lunchpadProvider: LunchpadProvider,
    private readonly logger: AppLogger,
  ) {}

  // @Post('getSellOrders')
  // @AvoidGuards([WalletGuard])
  // async getOrders(
  //   @Body() body: GetOrdersDto,
  //   @Query('ticker') ticker: string,
  // ): Promise<{ orders: ListedOrderDto[]; totalCount: number }> {
  //   try {
  //     if (!ticker) {
  //       throw new HttpException('Ticker is required', HttpStatus.BAD_REQUEST);
  //     }
  //     return await this.p2pProvider.listOrders(ticker, body);
  //   } catch (error) {
  //     this.logger.error('Error getting sell orders', error);
  //     throw error;
  //   }
  // }

  @Post('create')
  async createLunchpadOrder(@Request() req, @Body() body: CreateLunchpadRequestDto): Promise<CreateLunchpadResponseDto> {
    return await this.lunchpadProvider.createLunchpad(body, req.wallet);
  }
}
