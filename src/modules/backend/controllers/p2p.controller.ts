import {
  Request,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Delete,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { P2pProvider } from '../providers/p2p.provider';
import { SellRequestDto } from '../model/dtos/sell-request.dto';
import { SellRequestResponseDto } from '../model/dtos/responses/sell-request.response.dto';
import { ConfirmSellOrderRequestResponseDto } from '../model/dtos/responses/confirm-sell-order-request.response.dto';
import { BuyRequestResponseDto } from '../model/dtos/responses/buy-request.response.dto';
import { ConfirmBuyOrderRequestResponseDto } from '../model/dtos/responses/confirm-buy-order-request.response.dto';
import { SellOrderResponseDto } from '../model/dtos/responses/sell-order.response.dto';
import { kaspaToSompi, PrivateKey } from 'libs/kaspa/kaspa';
import { KaspaNetworkActionsService } from '../services/kaspa-network/kaspa-network-actions.service';
import { AppConfigService } from 'src/modules/core/modules/config/app-config.service';
import { BuyRequestDto } from '../model/dtos/buy-request.dto';
import { ConfirmBuyRequestDto } from '../model/dtos/confirm-buy-request.dto';
import { GetSellOrdersRequestDto } from '../model/dtos/get-sell-orders-request.dto';
import { KasplexApiService } from '../services/kasplex-api/services/kasplex-api.service';

const TEST_AMOUNT = kaspaToSompi('20.1818');
@Controller('p2p')
export class P2pController {
  constructor(
    private readonly p2pProvider: P2pProvider,
    private readonly kaspaNetworkActionsService: KaspaNetworkActionsService,
    private readonly config: AppConfigService,
    private readonly kasplexApiService: KasplexApiService,
  ) {}

  @Post('getSellOrders')
  async getSellOrders(@Body() body: GetSellOrdersRequestDto, @Query('ticker') ticker: string): Promise<SellOrderResponseDto[]> {
    try {
      if (!ticker) {
        throw new HttpException('Ticker is required', HttpStatus.BAD_REQUEST);
      }
      return await this.p2pProvider.listOrders(ticker, body);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Starts the selling flow
   * @param sellRequestDto  The Sell information
   */
  @Post('sell')
  async sellToken(@Body() sellRequestDto: SellRequestDto): Promise<SellRequestResponseDto> {
    try {
      return await this.p2pProvider.createOrder(sellRequestDto);
    } catch (error) {
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
      throw error;
    }
  }

  @Delete('cancel/:sellOrderId')
  async cancelSellOrder(@Param('sellOrderId') sellOrderId: string): Promise<void> {
    try {
      return await this.p2pProvider.cancelSell(sellOrderId);
    } catch (error) {
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
      throw error;
    }
  }

  @Get('feeRate')
  async getFeeRate() {
    return await this.p2pProvider.getCurrentFeeRate();
  }

  @Post('generateMasterWallet')
  async generateMasterWallet(@Request() req) {
    const token = req.headers['authorization'];
    if (token != this.config.generateMasterSeedPassword) {
      throw new NotFoundException();
    }
    return this.p2pProvider.generateMasterWallet();
  }

  @Get('test')
  async test() {
    const res = await this.kaspaNetworkActionsService.transferKrc20Token(
      new PrivateKey('0b5d9532d0d8598cce39157129a97fbce8732a72cc2186eb1bcb9426435d3058'),
      'GILADA',
      'kaspatest:qqnvk0l36gn47l2mnktq5m67csmm79wlczva4jcen6xnt6q4z430ccs8dzgzn',
      kaspaToSompi('10'),
      0n,
    );

    const res2 = await this.kaspaNetworkActionsService.transferKaspa(
      new PrivateKey('0b5d9532d0d8598cce39157129a97fbce8732a72cc2186eb1bcb9426435d3058'),
      [
        {
          address: 'kaspatest:qqnvk0l36gn47l2mnktq5m67csmm79wlczva4jcen6xnt6q4z430ccs8dzgzn',
          amount: TEST_AMOUNT + kaspaToSompi('5'),
        },
      ],
      0n,
    );

    console.log('result', res, res2);

    return 'asd MF';
  }

  @Get('test2')
  async test2() {
    await this.kaspaNetworkActionsService.logMyWallets('before');

    const res = await this.kaspaNetworkActionsService.transferKaspa(
      new PrivateKey('acc0ca3018947d067cff6abefc453080706d408324e8728b2c63e8da46efed7d'),
      [
        {
          address: 'kaspatest:qqvy0kf7yf2dzz0cmsaaf7gdt9nn6dh7ykvztdn9cev5wm0jp6dgv26v7c7mv',
          amount: kaspaToSompi('0.21'),
        },
        {
          address: 'kaspatest:qqnvk0l36gn47l2mnktq5m67csmm79wlczva4jcen6xnt6q4z430ccs8dzgzn',
          amount: kaspaToSompi('0.25'),
        },
        {
          address: 'kaspatest:qzaxjq87c3yl8xggv8fl39smmahvl8yusgcrw45equjeu8hfz5wtct9y4n96t',
          amount: kaspaToSompi('0.31'),
        },
      ],
      0n,
    );

    await this.kaspaNetworkActionsService.logMyWallets('after');

    console.log('result', res);

    return 'asd MF 2';
  }

  @Get('test3')
  async test3() {
    // return this.kaspaNetworkActionsService.generateMasterWallet();
    // const res = await this.kaspaNetworkActionsService.createWallet();
    // const res = await this.kaspaNetworkActionsService.createAccount();
    // console.log('result', res);
    // return res;

    // return this.kaspaNetworkActionsService.getWalletTotalBalance('kaspatest:qq357v269w74lcp4t803jvqhyxj6y2jmkf00n44unhpcz85tvgzzqkxj3pr84');
    return await this.kaspaNetworkActionsService.verifyTransactionResultWithKaspaApiAndWalletTotalAmount(
      '212831f997aec88ac1358549deb41436f213428ea08810566ea075be765865ff',
      'kaspatest:qpdzgy8gvav58tgjwlxr7sj8fd6888r8l93tvqnkkwk3mhy8phgd5uq3yrpc2',
      'kaspatest:qqnvk0l36gn47l2mnktq5m67csmm79wlczva4jcen6xnt6q4z430ccs8dzgzn',
      2518180000n,
    );
  }

  @Get('test4')
  async test4() {
    const res = await this.kaspaNetworkActionsService.doSellSwap(
      new PrivateKey('89ccb3e6969aa3bb48568de3172fd5ae31942ca8cb3aace665931b11cb033cc8'),
      'kaspatest:qqvy0kf7yf2dzz0cmsaaf7gdt9nn6dh7ykvztdn9cev5wm0jp6dgv26v7c7mv',
      'kaspatest:qzaxjq87c3yl8xggv8fl39smmahvl8yusgcrw45equjeu8hfz5wtct9y4n96t',
      'GILADA',
      kaspaToSompi('10'),
      TEST_AMOUNT,
    );

    console.log('result', res);

    return res;
  }

  @Get('test5')
  async test5() {
    const res = await this.kaspaNetworkActionsService.cancelSellSwap(
      new PrivateKey('89ccb3e6969aa3bb48568de3172fd5ae31942ca8cb3aace665931b11cb033cc8'),
      'kaspatest:qpdzgy8gvav58tgjwlxr7sj8fd6888r8l93tvqnkkwk3mhy8phgd5uq3yrpc2',
      'GILADA',
      kaspaToSompi('250'),
    );

    console.log('result', res);

    return res;
  }
}
