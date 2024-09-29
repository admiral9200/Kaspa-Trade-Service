import { Body, Controller, Get, HttpException, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { P2pProvider } from '../providers/p2p.provider';
import { SellOrderDto } from '../model/dtos/sell-order.dto';
import { SellRequestResponseDto } from '../model/dtos/responses/sell-request.response.dto';
import { ConfirmSellOrderRequestResponseDto } from '../model/dtos/responses/confirm-sell-order-request.response.dto';
import { BuyRequestResponseDto } from '../model/dtos/responses/buy-request.response.dto';
import { ConfirmBuyOrderRequestResponseDto } from '../model/dtos/responses/confirm-buy-order-request.response.dto';
import { AppConfigService } from 'src/modules/core/modules/config/app-config.service';
import { BuyRequestDto } from '../model/dtos/buy-request.dto';
import { ConfirmBuyRequestDto } from '../model/dtos/confirm-buy-request.dto';
import { GetOrdersDto } from '../model/dtos/get-orders.dto';
import { ListedOrderDto } from '../model/dtos/listed-order.dto';
import { GetUserListingsDto } from '../model/dtos/user-listings.dto';
import { ConfirmDelistRequestDto } from '../model/dtos/confirm-delist-request.dto';
import { ConfirmDelistOrderRequestResponseDto } from '../model/dtos/responses/confirm-delist-order-request.response.dto copy';
import { RemoveFromMarketplaceRequestDto } from '../model/dtos/remove-from-marketplace-request.dto';
import { OffMarketplaceRequestResponseDto } from '../model/dtos/responses/off-marketplace-request.response.dto';
import { UpdateSellOrderDto } from '../model/dtos/update-sell-order.dto';
import { RelistSellOrderDto } from '../model/dtos/relist-sell-order.dto';
import { GetOrdersHistoryResponseDto } from '../model/dtos/get-orders-history-response.dto';
import { AppLoggerService } from '../../core/modules/logger/app-logger.service';
import { GetOrdersHistoryDto } from '../model/dtos/get-orders-history.dto';

@Controller('p2p')
export class P2pController {
  constructor(
    private readonly p2pProvider: P2pProvider,
    private readonly config: AppConfigService,
    private readonly logger: AppLoggerService,
  ) {}

  @Post('getSellOrders')
  async getOrders(
    @Body() body: GetOrdersDto,
    @Query('ticker') ticker: string,
  ): Promise<{ orders: ListedOrderDto[]; totalCount: number }> {
    try {
      if (!ticker) {
        throw new HttpException('Ticker is required', HttpStatus.BAD_REQUEST);
      }
      return await this.p2pProvider.listOrders(ticker, body);
    } catch (error) {
      this.logger.error('Error getting sell orders', error);
      throw error;
    }
  }

  @Post('getUserListings')
  async getListings(@Body() body: GetUserListingsDto): Promise<{ orders: ListedOrderDto[]; totalCount: number }> {
    try {
      return await this.p2pProvider.userListings(body);
    } catch (error) {
      this.logger.error('Error getting user listings', error);
      throw error;
    }
  }

  @Post('getOrdersHistory')
  async getOrdersHistory(@Body() GetOrdersHistoryDto: GetOrdersHistoryDto): Promise<GetOrdersHistoryResponseDto> {
    try {
      return await this.p2pProvider.getOrdersHistory(GetOrdersHistoryDto);
    } catch (error) {
      this.logger.error('Error getting orders history', error);
      throw error;
    }
  }

  /**
   * Starts the selling flow
   * @param sellRequestDto  The Sell information
   */
  @Post('sell')
  async sellToken(@Body() sellRequestDto: SellOrderDto): Promise<SellRequestResponseDto> {
    try {
      return await this.p2pProvider.createOrder(sellRequestDto);
    } catch (error) {
      this.logger.error('Error creating sell order', error);
      throw error;
    }
  }

  /**
   * Validates that the seller has sent the tokens to the temporary wallet
   * @param sellOrderId The order ID of the sell order
   */
  @Get('confirmSellOrder/:sellOrderId')
  async confirmSellOrder(@Param('sellOrderId') sellOrderId: string): Promise<ConfirmSellOrderRequestResponseDto> {
    try {
      return await this.p2pProvider.confirmSell(sellOrderId);
    } catch (error) {
      this.logger.error('Error confirming sell order', error);
      throw error;
    }
  }

  @Post('removeFromMarketplace/:sellOrderId')
  async removeSellOrderFromMarketplace(
    @Param('sellOrderId') sellOrderId: string,
    @Body() body: RemoveFromMarketplaceRequestDto,
  ): Promise<OffMarketplaceRequestResponseDto> {
    try {
      return await this.p2pProvider.removeSellOrderFromMarketplace(sellOrderId, body.walletAddress);
    } catch (error) {
      this.logger.error('Error removing sell order from marketplace', error);
      throw error;
    }
  }

  @Get('getOrderStatus/:sellOrderId')
  async getOrderStatus(sellOrderId: string) {
    try {
      return await this.p2pProvider.getOrderStatus(sellOrderId);
    } catch (error) {
      this.logger.error('Error getting order status', error);
      throw error;
    }
  }

  @Post('updateSellOrder/:sellOrderId')
  async updateSellOrder(@Param('sellOrderId') sellOrderId: string, @Body() body: UpdateSellOrderDto): Promise<void> {
    try {
      await this.p2pProvider.updateSellOrder(sellOrderId, body);
    } catch (error) {
      this.logger.error('Error updating sell order', error);
      throw error;
    }
  }

  @Post('relistSellOrder/:sellOrderId')
  async relistOrder(@Param('sellOrderId') sellOrderId: string, @Body() body: RelistSellOrderDto): Promise<void> {
    try {
      await this.p2pProvider.relistSellOrder(sellOrderId, body);
    } catch (error) {
      this.logger.error('Error relisting sell order', error);
      throw error;
    }
  }

  @Post('confirmDelistOrder/:sellOrderId')
  async confirmDelistOrder(
    @Param('sellOrderId') sellOrderId: string,
    @Body() body: ConfirmDelistRequestDto,
  ): Promise<ConfirmDelistOrderRequestResponseDto> {
    try {
      return await this.p2pProvider.confirmDelistSale(sellOrderId, body);
    } catch (error) {
      this.logger.error('Error confirming delist order', error);
      throw error;
    }
  }

  @Post('releaseBuyLock/:sellOrderId')
  async releaseBuyLock(@Param('sellOrderId') sellOrderId: string): Promise<void> {
    try {
      return await this.p2pProvider.releaseBuyLock(sellOrderId);
    } catch (error) {
      this.logger.error('Error releasing buy lock', error);
      throw error;
    }
  }

  /**
   * Starts the buying flow
   * @param sellOrderId The order ID of the sell order
   * @param body
   */
  @Post('buy/:sellOrderId')
  async buyToken(@Param('sellOrderId') sellOrderId: string, @Body() body: BuyRequestDto): Promise<BuyRequestResponseDto> {
    try {
      return await this.p2pProvider.buy(sellOrderId, body);
    } catch (error) {
      this.logger.error('Error buying token', error);
      throw error;
    }
  }

  /**
   * Confirms that the buyer has sent the payment to the seller
   * @param sellOrderId The order ID of the sell order
   * @param body
   */
  @Post('confirmBuyOrder/:sellOrderId')
  async confirmBuy(
    @Param('sellOrderId') sellOrderId: string,
    @Body() body: ConfirmBuyRequestDto,
  ): Promise<ConfirmBuyOrderRequestResponseDto> {
    try {
      return await this.p2pProvider.confirmBuy(sellOrderId, body);
    } catch (error) {
      this.logger.error('Error confirming buy order', error);
      throw error;
    }
  }

  @Get('feeRate')
  async getFeeRate() {
    return await this.p2pProvider.getCurrentFeeRate();
  }
}
