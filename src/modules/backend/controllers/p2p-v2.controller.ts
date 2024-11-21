import { Body, Controller, Get, HttpException, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AppLogger } from 'src/modules/core/modules/logger/app-logger.abstract';
import { JwtWalletAuthGuard } from '../guards/jwt-wallet-auth.guard';
import { CurrentAuthWalletInfo } from '../guards/jwt-wallet.strategy';
import { AuthWalletInfo } from '../model/dtos/auth/auth-wallet-info';
import { P2pV2Provider } from '../providers/p2p-v2.provider';
import { SellOrderV2Dto } from '../model/dtos/p2p-orders/sell-order-v2.dto';
import { SellRequestV2ResponseDto } from '../model/dtos/p2p-orders/responses/sell-request-v2.response.dto';
import { ListedOrderV2Dto } from '../model/dtos/p2p-orders/listed-order-v2.dto';
import { GetUserOrdersRequestDto } from '../model/dtos/p2p-orders/get-user-orders-request.dto';
import { UserOrdersResponseDto } from '../model/dtos/p2p-orders/user-orders-response.dto';
import { SkipGuards } from '../guards/infra/skipGuardsService';
import { GetOrdersDto } from '../model/dtos/p2p-orders/get-orders.dto';
import { ListedOrderDto } from '../model/dtos/p2p-orders/listed-order.dto';

@Controller('p2p-v2')
@UseGuards(JwtWalletAuthGuard)
export class P2pV2Controller {
  constructor(
    private readonly p2pV2Provider: P2pV2Provider,
    private readonly logger: AppLogger,
  ) {}
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
    @Body('transactionId') transactionId: string,
  ): Promise<ListedOrderV2Dto> {
    return await this.p2pV2Provider.buy(sellOrderId, walletInfo.walletAddress, transactionId);
  }

  @Post('cancel/:sellOrderId')
  async cancel(
    @CurrentAuthWalletInfo() walletInfo: AuthWalletInfo,
    @Param('sellOrderId') sellOrderId: string,
  ): Promise<ListedOrderV2Dto> {
    return await this.p2pV2Provider.cancel(sellOrderId);
  }

  @Post('sell-orders')
  @SkipGuards([JwtWalletAuthGuard])
  async getSellOrders(
    @Body() body: GetOrdersDto,
    @Query('ticker') ticker: string,
  ): Promise<{ orders: ListedOrderDto[]; totalCount: number }> {
    return await this.p2pV2Provider.getSellOrders(ticker, body);
  }

  @Post('user-orders')
  async getUserOrders(
    @CurrentAuthWalletInfo() walletInfo: AuthWalletInfo,
    @Body() userOrdersDto: GetUserOrdersRequestDto,
  ): Promise<UserOrdersResponseDto> {
    try {
      if (!userOrdersDto.filters) {
        userOrdersDto.filters = { isBuyer: true, isSeller: true };
      }

      if (!userOrdersDto.filters.isBuyer && !userOrdersDto.filters.isSeller) {
        throw new HttpException('Either isBuyer or isSeller must be true', HttpStatus.BAD_REQUEST);
      }

      return await this.p2pV2Provider.getUserOrders(userOrdersDto, walletInfo.walletAddress);
    } catch (error) {
      this.logger.error('Error getting orders history', error);
      throw error;
    }
  }
}
