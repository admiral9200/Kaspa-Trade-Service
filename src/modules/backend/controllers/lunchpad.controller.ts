import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CreateLunchpadRequestDto } from '../model/dtos/lunchpad/create-lunchpad-request.dto';
import { LunchpadProvider } from '../providers/lunchpad.provider';
import {
  ClientSideLunchpadOrderWithStatus,
  ClientSideLunchpadWithStatus,
  LunchpadTransformer,
} from '../transformers/lunchpad.transformer';
import { CreateLunchpadOrderRequestDto } from '../model/dtos/lunchpad/create-lunchpad-order-request.dto';
import { ProcessLunchpadOrderRequestDto } from '../model/dtos/lunchpad/process-lunchpad-order-request.dto';
import { JwtWalletAuthGuard } from '../guards/jwt-wallet-auth.guard';
import { CurrentAuthWalletInfo } from '../guards/jwt-wallet.strategy';
import { AuthWalletInfo } from '../model/dtos/auth/auth-wallet-info';
import { SkipGuards } from '../guards/infra/skipGuardsService';

@Controller('lunchpad')
@UseGuards(JwtWalletAuthGuard)
export class LunchpadController {
  constructor(private readonly lunchpadProvider: LunchpadProvider) {}

  @Get(':ticker')
  @SkipGuards([JwtWalletAuthGuard])
  async getLunchpad(@Param('ticker') ticker: string): Promise<ClientSideLunchpadWithStatus> {
    const result = await this.lunchpadProvider.getLunchpadByTicker(ticker);

    return {
      success: result.success,
      lunchpad: result.lunchpad
        ? LunchpadTransformer.transformLunchpadDataToClientSide(result.lunchpad, result.walletAddress)
        : null,
      errorCode: result.errorCode,
    };
  }

  @Post('create')
  async createLunchpadOrder(
    @CurrentAuthWalletInfo() walletInfo: AuthWalletInfo,
    @Body() body: CreateLunchpadRequestDto,
  ): Promise<ClientSideLunchpadWithStatus> {
    const result = await this.lunchpadProvider.createLunchpad(body, walletInfo.walletAddress);

    return {
      success: result.success,
      lunchpad: result.lunchpad
        ? LunchpadTransformer.transformLunchpadDataToClientSide(result.lunchpad, result.walletAddress)
        : null,
    };
  }

  @Post(':id/start')
  async startLunchpad(
    @Param('id') id: string,
    @CurrentAuthWalletInfo() walletInfo: AuthWalletInfo,
  ): Promise<ClientSideLunchpadWithStatus> {
    const result = await this.lunchpadProvider.startLunchpad(id, walletInfo.walletAddress);

    return {
      success: result.success,
      errorCode: result.errorCode,
      lunchpad: result.lunchpad
        ? LunchpadTransformer.transformLunchpadDataToClientSide(result.lunchpad, result.walletAddress, result.krc20TokensAmount)
        : null,
    };
  }

  @Post(':ticker/create-order')
  async createLunchpadOrderWithId(
    @Param('ticker') ticker: string,
    @Body() body: CreateLunchpadOrderRequestDto,
    @CurrentAuthWalletInfo() walletInfo: AuthWalletInfo,
  ): Promise<ClientSideLunchpadOrderWithStatus> {
    const result = await this.lunchpadProvider.createLunchpadOrder(ticker, body, walletInfo.walletAddress);

    return {
      success: result.success,
      errorCode: result.errorCode,
      lunchpadOrder: result.lunchpadOrder
        ? LunchpadTransformer.transformLunchpadOrderDataToClientSide(result.lunchpadOrder)
        : null,
      lunchpad: result.lunchpad ? LunchpadTransformer.transformLunchpadDataToClientSide(result.lunchpad) : null,
    };
  }

  @Post(':orderId/verify-process-order')
  async startVerifyAndProcessOrder(
    @Param('orderId') orderId: string,
    @Body() body: ProcessLunchpadOrderRequestDto,
    @CurrentAuthWalletInfo() walletInfo: AuthWalletInfo,
  ): Promise<ClientSideLunchpadOrderWithStatus> {
    const result = await this.lunchpadProvider.verifyOrderAndStartLunchpadProcess(
      orderId,
      walletInfo.walletAddress,
      body.transactionId,
    );

    return {
      success: result.success,
      errorCode: result.errorCode,
      lunchpadOrder: result.lunchpadOrder
        ? LunchpadTransformer.transformLunchpadOrderDataToClientSide(result.lunchpadOrder)
        : null,
      lunchpad: result.lunchpad ? LunchpadTransformer.transformLunchpadDataToClientSide(result.lunchpad) : null,
    };
  }

  @Post(':orderId/cancel-order')
  async cancelOrder(
    @Param('orderId') orderId: string,
    @CurrentAuthWalletInfo() walletInfo: AuthWalletInfo,
  ): Promise<ClientSideLunchpadOrderWithStatus> {
    const result = await this.lunchpadProvider.cancelOrder(orderId, walletInfo.walletAddress);

    return {
      success: result.success,
      errorCode: result.errorCode,
      lunchpadOrder: result.lunchpadOrder
        ? LunchpadTransformer.transformLunchpadOrderDataToClientSide(result.lunchpadOrder)
        : null,
      lunchpad: result.lunchpad ? LunchpadTransformer.transformLunchpadDataToClientSide(result.lunchpad) : null,
    };
  }
}
