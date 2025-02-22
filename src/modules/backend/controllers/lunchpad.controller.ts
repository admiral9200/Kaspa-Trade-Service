import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CreateLunchpadRequestDto } from '../model/dtos/lunchpad/create-lunchpad-request.dto';
import { LunchpadProvider } from '../providers/lunchpad.provider';
import {
  ClientSideLunchpadListWithStatus,
  ClientSideLunchpadOrderListWithStatus,
  ClientSideLunchpadOrderWithStatus,
  ClientSideLunchpadWithStatus,
  ClientSideUserLunchpadOrderListWithStatus,
  LunchpadTransformer,
} from '../transformers/lunchpad.transformer';
import { CreateLunchpadOrderRequestDto } from '../model/dtos/lunchpad/create-lunchpad-order-request.dto';
import { ProcessLunchpadOrderRequestDto } from '../model/dtos/lunchpad/process-lunchpad-order-request.dto';
import { JwtWalletAuthGuard } from '../guards/jwt-wallet-auth.guard';
import { CurrentAuthWalletInfo } from '../guards/jwt-wallet.strategy';
import { AuthWalletInfo } from '../model/dtos/auth/auth-wallet-info';
import { SkipGuards } from '../guards/infra/skipGuardsService';
import { LunchpadWalletType } from '../model/enums/lunchpad-wallet-type.enum';
import { GetLunchpadListDto } from '../model/dtos/lunchpad/get-lunchpad-list';
import { UpdateLunchpadRequestDto } from '../model/dtos/lunchpad/update-lunchpad-request.dto';
import { GetLunchpadOrderListDto } from '../model/dtos/lunchpad/get-lunchpad-order-list';
import { AllowWithoutWallet } from '../guards/infra/allowWithoutWalletService';
import { GetUserLunchpadOrderListDto } from '../model/dtos/lunchpad/get-user-lunchpad-order-list';

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

  @Post('list')
  @AllowWithoutWallet()
  async getLucnhpads(
    @Body() getLaunchpadUserListDto: GetLunchpadListDto,
    @CurrentAuthWalletInfo() authWalletInfo?: AuthWalletInfo,
  ): Promise<ClientSideLunchpadListWithStatus> {
    const lunchpadListData = await this.lunchpadProvider.getLunchpadList(getLaunchpadUserListDto, authWalletInfo?.walletAddress);
    return LunchpadTransformer.transformLunchpadListDataWithStatusToClientSide(
      lunchpadListData.lunchpads,
      lunchpadListData.totalCount,
    );
  }

  @Post(':ticker/owner-info')
  async getLunchpadForOwner(
    @Param('ticker') ticker: string,
    @CurrentAuthWalletInfo() walletInfo: AuthWalletInfo,
  ): Promise<ClientSideLunchpadWithStatus> {
    const result = await this.lunchpadProvider.getLunchpadByTicker(ticker, walletInfo.walletAddress);

    return {
      success: result.success,
      lunchpad: result.lunchpad
        ? LunchpadTransformer.transformLunchpadDataToClientSide(
            result.lunchpad,
            result.walletAddress,
            result.senderWalletAddress,
            result.krc20TokensAmount,
            result.requiredKaspa,
            result.openOrders,
            true,
            result.walletTokensAmount,
            result.walletUnits,
          )
        : null,
      errorCode: result.errorCode,
    };
  }

  @Post('create')
  async createLunchpad(
    @CurrentAuthWalletInfo() walletInfo: AuthWalletInfo,
    @Body() body: CreateLunchpadRequestDto,
  ): Promise<ClientSideLunchpadWithStatus> {
    const result = await this.lunchpadProvider.createLunchpad(body, walletInfo.walletAddress);

    return {
      success: result.success,
      lunchpad: result.lunchpad
        ? LunchpadTransformer.transformLunchpadDataToClientSide(
            result.lunchpad,
            result.walletAddress,
            result.senderWalletAddress,
            null,
            result.requiredKaspa,
            result.openOrders,
            true,
          )
        : null,
    };
  }

  @Post(':id/update')
  async updateLunchpad(
    @CurrentAuthWalletInfo() walletInfo: AuthWalletInfo,
    @Param('id') id: string,
    @Body() body: UpdateLunchpadRequestDto,
  ): Promise<ClientSideLunchpadWithStatus> {
    const result = await this.lunchpadProvider.updateLunchpad(id, body, walletInfo.walletAddress);

    return {
      success: result.success,
      lunchpad: result.lunchpad
        ? LunchpadTransformer.transformLunchpadDataToClientSide(
            result.lunchpad,
            result.walletAddress,
            result.senderWalletAddress,
            null,
            result.requiredKaspa,
            result.openOrders,
            true,
          )
        : null,
    };
  }

  @Get(':id/estimate-kas')
  async estimateKasRequirement(
    @Param('id') id: string,
    @CurrentAuthWalletInfo() walletInfo: AuthWalletInfo,
  ): Promise<ClientSideLunchpadWithStatus> {
    const result = await this.lunchpadProvider.startLunchpad(id, walletInfo.walletAddress, true);

    return {
      success: result.success,
      errorCode: result.errorCode,
      lunchpad: result.lunchpad
        ? LunchpadTransformer.transformLunchpadDataToClientSide(
            result.lunchpad,
            result.walletAddress,
            result.senderWalletAddress,
            result.krc20TokensAmount,
            result.requiredKaspa,
            result.openOrders,
            true,
          )
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
        ? LunchpadTransformer.transformLunchpadDataToClientSide(
            result.lunchpad,
            result.walletAddress,
            result.senderWalletAddress,
            result.krc20TokensAmount,
            result.requiredKaspa,
            result.openOrders,
            true,
          )
        : null,
    };
  }

  @Post(':id/stop')
  async stopLunchpad(
    @Param('id') id: string,
    @CurrentAuthWalletInfo() walletInfo: AuthWalletInfo,
  ): Promise<ClientSideLunchpadWithStatus> {
    const result = await this.lunchpadProvider.stopLunchpad(id, walletInfo.walletAddress);

    return {
      success: result.success,
      errorCode: result.errorCode,
      lunchpad: result.lunchpad
        ? LunchpadTransformer.transformLunchpadDataToClientSide(
            result.lunchpad,
            result.walletAddress,
            result.senderWalletAddress,
            result.krc20TokensAmount,
            result.requiredKaspa,
            result.openOrders,
            true,
          )
        : null,
    };
  }

  @Post(':id/retrieve-funds/:walletType')
  async retrieveFunds(
    @Param('id') id: string,
    @Param('walletType') walletType: LunchpadWalletType,
    @CurrentAuthWalletInfo() walletInfo: AuthWalletInfo,
  ): Promise<ClientSideLunchpadWithStatus> {
    const result = await this.lunchpadProvider.retreiveFunds(id, walletInfo.walletAddress, walletType);

    return {
      success: result.success,
      errorCode: result.errorCode,
      lunchpad: result.lunchpad
        ? LunchpadTransformer.transformLunchpadDataToClientSide(
            result.lunchpad,
            result.walletAddress,
            result.senderWalletAddress,
            result.krc20TokensAmount,
            result.requiredKaspa,
            result.openOrders,
            true,
          )
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
        ? LunchpadTransformer.transformLunchpadOrderDataToClientSide(
            result.lunchpadOrder,
            result.lunchpad.kasPerUnit,
            result.lunchpad.tokenPerUnit,
          )
        : null,
      lunchpad: result.lunchpad ? LunchpadTransformer.transformLunchpadDataToClientSide(result.lunchpad) : null,
    };
  }

  @Get(':ticker/is-whitelisted')
  async checkUserWhitelisted(
    @Param('ticker') ticker: string,
    @CurrentAuthWalletInfo() walletInfo: AuthWalletInfo,
  ): Promise<ClientSideLunchpadWithStatus> {
    const result = await this.lunchpadProvider.isWalletWhitelisted(ticker, walletInfo.walletAddress);

    return {
      success: result.success,
      errorCode: result.errorCode,
      lunchpad: result.lunchpad ? LunchpadTransformer.transformLunchpadDataToClientSide(result.lunchpad) : null,
    };
  }

  @Post(':orderId/verify-process-order')
  async startVerifyAndProcessOrder(
    @Param('orderId') orderId: string,
    @Body() body: ProcessLunchpadOrderRequestDto,
    @CurrentAuthWalletInfo() walletInfo: AuthWalletInfo,
  ): Promise<ClientSideLunchpadOrderWithStatus> {
    const result = await this.lunchpadProvider.verifyOrderAndSetToVerified(orderId, walletInfo.walletAddress, body.transactionId);

    return {
      success: result.success,
      errorCode: result.errorCode,
      lunchpadOrder: result.lunchpadOrder
        ? LunchpadTransformer.transformLunchpadOrderDataToClientSide(
            result.lunchpadOrder,
            result.lunchpad.kasPerUnit,
            result.lunchpad.tokenPerUnit,
          )
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
        ? LunchpadTransformer.transformLunchpadOrderDataToClientSide(
            result.lunchpadOrder,
            result.lunchpad?.kasPerUnit,
            result.lunchpad?.tokenPerUnit,
          )
        : null,
      lunchpad: result.lunchpad ? LunchpadTransformer.transformLunchpadDataToClientSide(result.lunchpad) : null,
    };
  }

  @Post(':lunchpadId/orders-list')
  async getLucnhpadOrdersList(
    @Param('lunchpadId') lunchpadId: string,
    @CurrentAuthWalletInfo() authWalletInfo: AuthWalletInfo,
    @Body() getLaunchpadOrderListDto: GetLunchpadOrderListDto,
  ): Promise<ClientSideLunchpadOrderListWithStatus> {
    const lunchpadOrderListData = await this.lunchpadProvider.getLunchpadOrdersList(
      lunchpadId,
      getLaunchpadOrderListDto,
      authWalletInfo.walletAddress,
    );
    return LunchpadTransformer.transformLunchpadOrdersListToClientSide(
      lunchpadOrderListData.orders,
      lunchpadOrderListData.totalCount,
    );
  }

  @Post('orders-list')
  async getUserOrdersList(
    @CurrentAuthWalletInfo() authWalletInfo: AuthWalletInfo,
    @Body() getLaunchpadOrderListDto: GetUserLunchpadOrderListDto,
  ): Promise<ClientSideUserLunchpadOrderListWithStatus> {
    const lunchpadOrderListData = await this.lunchpadProvider.getUserLunchpadOrdersList(
      getLaunchpadOrderListDto,
      authWalletInfo.walletAddress,
    );
    return LunchpadTransformer.transformLunchpadUserOrdersListToClientSide(
      lunchpadOrderListData.orders,
      lunchpadOrderListData.totalCount,
      lunchpadOrderListData.tickers,
    );
  }
}
