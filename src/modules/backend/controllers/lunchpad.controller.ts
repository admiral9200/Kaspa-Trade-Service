import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { WalletGuard } from '../guards/wallet.guard';
import { CreateLunchpadRequestDto } from '../model/dtos/lunchpad/create-lunchpad-request.dto';
import { LunchpadProvider } from '../providers/lunchpad.provider';
import {
  ClientSideLunchpadOrderWithStatus,
  ClientSideLunchpadWithStatus,
  LunchpadTransformer,
} from '../transformers/lunchpad.transformer';
import { AvoidGuards } from '../guards/infra/avoidGuard';
import { CreateLunchpadOrderRequestDto } from '../model/dtos/lunchpad/create-lunchpad-order-request.dto';

@Controller('lunchpad')
@UseGuards(WalletGuard)
export class LunchpadController {
  constructor(private readonly lunchpadProvider: LunchpadProvider) {}

  @Get(':ticker')
  @AvoidGuards([WalletGuard])
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
  async createLunchpadOrder(@Request() req, @Body() body: CreateLunchpadRequestDto): Promise<ClientSideLunchpadWithStatus> {
    const result = await this.lunchpadProvider.createLunchpad(body, req.wallet);

    return {
      success: result.success,
      lunchpad: result.lunchpad
        ? LunchpadTransformer.transformLunchpadDataToClientSide(result.lunchpad, result.walletAddress)
        : null,
    };
  }

  @Post(':id/start')
  async startLunchpad(@Param('id') id: string, @Request() req): Promise<ClientSideLunchpadWithStatus> {
    const result = await this.lunchpadProvider.startLunchpad(id, req.wallet);

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
    @Request() req,
  ): Promise<ClientSideLunchpadOrderWithStatus> {
    const result = await this.lunchpadProvider.createLunchpadOrder(ticker, body, req.wallet);

    return {
      success: result.success,
      errorCode: result.errorCode,
      lunchpadOrder: result.lunchpadOrder
        ? LunchpadTransformer.transformLunchpadOrderDataToClientSide(result.lunchpadOrder)
        : null,
      lunchpad: result.lunchpad ? LunchpadTransformer.transformLunchpadDataToClientSide(result.lunchpad) : null,
    };
  }

  @Post(':orderId/process-order')
  async startProcessingOrder(@Param('orderId') orderId: string, @Request() req): Promise<ClientSideLunchpadOrderWithStatus> {
    const result = await this.lunchpadProvider.processOrder(orderId, req.wallet);

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
  async cancelOrder(@Param('orderId') orderId: string, @Request() req): Promise<ClientSideLunchpadOrderWithStatus> {
    const result = await this.lunchpadProvider.cancelOrder(orderId, req.wallet);

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
