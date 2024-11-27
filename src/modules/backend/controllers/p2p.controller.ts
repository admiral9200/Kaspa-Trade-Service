import { Body, Controller, Get, HttpException, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { P2pProvider } from '../providers/p2p.provider';
import { SellOrderDto } from '../model/dtos/p2p-orders/sell-order.dto';
import { SellRequestResponseDto } from '../model/dtos/p2p-orders/responses/sell-request.response.dto';
import { ConfirmSellOrderRequestResponseDto } from '../model/dtos/p2p-orders/responses/confirm-sell-order-request.response.dto';
import { BuyRequestResponseDto } from '../model/dtos/p2p-orders/responses/buy-request.response.dto';
import { ConfirmBuyOrderRequestResponseDto } from '../model/dtos/p2p-orders/responses/confirm-buy-order-request.response.dto';
import { ConfirmBuyRequestDto } from '../model/dtos/p2p-orders/confirm-buy-request.dto';
import { GetOrdersDto } from '../model/dtos/p2p-orders/get-orders.dto';
import { ListedOrderDto } from '../model/dtos/p2p-orders/listed-order.dto';
import { GetUserListingsDto } from '../model/dtos/p2p-orders/user-listings.dto';
import { ConfirmDelistRequestDto } from '../model/dtos/p2p-orders/confirm-delist-request.dto';
import { ConfirmDelistOrderRequestResponseDto } from '../model/dtos/p2p-orders/responses/confirm-delist-order-request.response.dto copy';
import { OffMarketplaceRequestResponseDto } from '../model/dtos/p2p-orders/responses/off-marketplace-request.response.dto';
import { UpdateSellOrderDto } from '../model/dtos/p2p-orders/update-sell-order.dto';
import { GetOrdersHistoryResponseDto } from '../model/dtos/p2p-orders/get-orders-history-response.dto';
import { GetOrdersHistoryDto } from '../model/dtos/p2p-orders/get-orders-history.dto';
import { AppLogger } from 'src/modules/core/modules/logger/app-logger.abstract';
import { JwtWalletAuthGuard } from '../guards/jwt-wallet-auth.guard';
import { CurrentAuthWalletInfo } from '../guards/jwt-wallet.strategy';
import { AuthWalletInfo } from '../model/dtos/auth/auth-wallet-info';
import { SkipGuards } from '../guards/infra/skipGuardsService';
import { CreateWithdrawalDto } from '../model/dtos/p2p-withdrawals/create-withdrawal.dto';
import { WithdrawalResponseDto } from '../model/dtos/p2p-withdrawals/withdrawal.response.dto';

@Controller('p2p')
@UseGuards(JwtWalletAuthGuard)
export class P2pController {
  constructor(
    private readonly p2pProvider: P2pProvider,
    private readonly logger: AppLogger,
  ) {}

  @Post('getSellOrders')
  @SkipGuards([JwtWalletAuthGuard])
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
  async getListings(
    @CurrentAuthWalletInfo() walletInfo: AuthWalletInfo,
    @Body() body: GetUserListingsDto,
  ): Promise<{ orders: ListedOrderDto[]; totalCount: number }> {
    try {
      return await this.p2pProvider.userListings(body, walletInfo.walletAddress);
    } catch (error) {
      this.logger.error('Error getting user listings', error);
      throw error;
    }
  }

  @Post('getOrdersHistory')
  async getOrdersHistory(
    @CurrentAuthWalletInfo() walletInfo: AuthWalletInfo,
    @Body() getOrdersHistoryDto: GetOrdersHistoryDto,
  ): Promise<GetOrdersHistoryResponseDto> {
    try {
      if (!getOrdersHistoryDto.filters) {
        getOrdersHistoryDto.filters = { isBuyer: true, isSeller: true };
      }

      if (!getOrdersHistoryDto.filters.isBuyer && !getOrdersHistoryDto.filters.isSeller) {
        throw new HttpException('Either isBuyer or isSeller must be true', HttpStatus.BAD_REQUEST);
      }

      return await this.p2pProvider.getOrdersHistory(getOrdersHistoryDto, walletInfo.walletAddress);
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
  async sellToken(
    @CurrentAuthWalletInfo() walletInfo: AuthWalletInfo,
    @Body() sellRequestDto: SellOrderDto,
  ): Promise<SellRequestResponseDto> {
    try {
      return await this.p2pProvider.createOrder(sellRequestDto, walletInfo.walletAddress);
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
    @CurrentAuthWalletInfo() walletInfo: AuthWalletInfo,
    @Param('sellOrderId') sellOrderId: string,
  ): Promise<OffMarketplaceRequestResponseDto> {
    try {
      return await this.p2pProvider.removeSellOrderFromMarketplace(sellOrderId, walletInfo.walletAddress);
    } catch (error) {
      this.logger.error('Error removing sell order from marketplace', error);
      throw error;
    }
  }

  @Get('getOrderStatus/:sellOrderId')
  async getOrderStatus(@CurrentAuthWalletInfo() walletInfo: AuthWalletInfo, sellOrderId: string) {
    try {
      return await this.p2pProvider.getOrderStatus(sellOrderId, walletInfo.walletAddress);
    } catch (error) {
      this.logger.error('Error getting order status', error);
      throw error;
    }
  }

  @Post('updateSellOrder/:sellOrderId')
  async updateSellOrder(
    @CurrentAuthWalletInfo() walletInfo: AuthWalletInfo,
    @Param('sellOrderId') sellOrderId: string,
    @Body() body: UpdateSellOrderDto,
  ): Promise<void> {
    try {
      await this.p2pProvider.updateSellOrder(sellOrderId, body, walletInfo.walletAddress);
    } catch (error) {
      this.logger.error('Error updating sell order', error);
      throw error;
    }
  }

  @Post('relistSellOrder/:sellOrderId')
  async relistOrder(
    @CurrentAuthWalletInfo() walletInfo: AuthWalletInfo,
    @Param('sellOrderId') sellOrderId: string,
  ): Promise<void> {
    try {
      await this.p2pProvider.relistSellOrder(sellOrderId, walletInfo.walletAddress);
    } catch (error) {
      this.logger.error('Error relisting sell order', error);
      throw error;
    }
  }

  @Post('confirmDelistOrder/:sellOrderId')
  async confirmDelistOrder(
    @CurrentAuthWalletInfo() walletInfo: AuthWalletInfo,
    @Param('sellOrderId') sellOrderId: string,
    @Body() body: ConfirmDelistRequestDto,
  ): Promise<ConfirmDelistOrderRequestResponseDto> {
    try {
      return await this.p2pProvider.confirmDelistSale(sellOrderId, body, walletInfo.walletAddress);
    } catch (error) {
      this.logger.error('Error confirming delist order', error);
      throw error;
    }
  }

  @Post('releaseBuyLock/:sellOrderId')
  async releaseBuyLock(
    @CurrentAuthWalletInfo() walletInfo: AuthWalletInfo,
    @Param('sellOrderId') sellOrderId: string,
  ): Promise<void> {
    try {
      return await this.p2pProvider.releaseBuyLock(sellOrderId, walletInfo.walletAddress);
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
  async buyToken(
    @CurrentAuthWalletInfo() walletInfo: AuthWalletInfo,
    @Param('sellOrderId') sellOrderId: string,
  ): Promise<BuyRequestResponseDto> {
    try {
      return await this.p2pProvider.buy(sellOrderId, walletInfo.walletAddress);
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

  @Get('walletAddress')
  async getWalletAddress(@CurrentAuthWalletInfo() walletInfo: AuthWalletInfo): Promise<string> {
    return walletInfo.walletAddress;
  }


  @Post('createWithdrawal')
  async createWithdrawal(
    @Body() body: CreateWithdrawalDto
  ): Promise<WithdrawalResponseDto> {
    try {
      return await this.p2pProvider.createWithdrawal(body);
    } catch (error) {
      this.logger.error('Error creating a withdrawal', error);
      throw error;
    }
  }
}
