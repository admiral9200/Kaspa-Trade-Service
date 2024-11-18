import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AppLogger } from 'src/modules/core/modules/logger/app-logger.abstract';
import { JwtWalletAuthGuard } from '../guards/jwt-wallet-auth.guard';
import { CurrentAuthWalletInfo } from '../guards/jwt-wallet.strategy';
import { AuthWalletInfo } from '../model/dtos/auth/auth-wallet-info';
import { P2pV2Provider } from '../providers/p2p-v2.provider';
import { SellOrderV2Dto } from '../model/dtos/p2p-orders/sell-order-v2.dto';
import { SellRequestV2ResponseDto } from '../model/dtos/p2p-orders/responses/sell-request-v2.response.dto';
import { ListedOrderV2Dto } from '../model/dtos/p2p-orders/listed-order-v2.dto';

@Controller('p2p-v2')
@UseGuards(JwtWalletAuthGuard)
export class P2pV2Controller {
  constructor(
    private readonly p2pV2Provider: P2pV2Provider,
    private readonly logger: AppLogger,
  ) {}

  // @Post('getSellOrders')
  // @SkipGuards([JwtWalletAuthGuard])
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

  @Post()
  async createSellOrder(
    @CurrentAuthWalletInfo() walletInfo: AuthWalletInfo,
    @Body() sellRequestDto: SellOrderV2Dto,
  ): Promise<SellRequestV2ResponseDto> {
    return await this.p2pV2Provider.createOrder(sellRequestDto, walletInfo.walletAddress);
  }

  @Get(':id')
  async getSellOrderById(@Param('id') id: string): Promise<ListedOrderV2Dto> {
    return await this.p2pV2Provider.getOrderById(id);
  }

  @Post('buy/:sellOrderId')
  async buyToken(
    @CurrentAuthWalletInfo() walletInfo: AuthWalletInfo,
    @Param('sellOrderId') sellOrderId: string,
  ): Promise<ListedOrderV2Dto> {
    return await this.p2pV2Provider.buy(sellOrderId, walletInfo.walletAddress);
  }

  @Post('cancel/:sellOrderId')
  async cancel(
    @CurrentAuthWalletInfo() walletInfo: AuthWalletInfo,
    @Param('sellOrderId') sellOrderId: string,
  ): Promise<ListedOrderV2Dto> {
    return await this.p2pV2Provider.cancel(sellOrderId, walletInfo.walletAddress);
  }
}
