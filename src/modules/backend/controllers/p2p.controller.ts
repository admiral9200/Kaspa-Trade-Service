import { Request, Body, Controller, Get, NotFoundException, Param, Post, Delete } from '@nestjs/common';
import { P2pProvider } from '../providers/p2p.provider';
import { SellRequestDto } from '../model/dtos/sell-request.dto';
import { SellRequestResponseDto } from '../model/dtos/responses/sell-request.response.dto';
import { ConfirmSellOrderRequestResponseDto } from '../model/dtos/responses/confirm-sell-order-request.response.dto';
import { BuyRequestResponseDto } from '../model/dtos/responses/buy-request.response.dto';
import { ConfirmBuyOrderRequestResponseDto } from '../model/dtos/responses/confirm-buy-order-request.response.dto';
import { SellOrderResponseDto } from '../model/dtos/responses/sell-order.response.dto';
import { kaspaToSompi, PrivateKey } from 'libs/kaspa-dev/kaspa';
import { KaspaNetworkActionsService } from '../services/kaspa-network/kaspa-network-actions.service';
import { AppConfigService } from 'src/modules/core/modules/config/app-config.service';
import { BuyRequestDto } from '../model/dtos/buy-request.dto';
import { ConfirmBuyRequestDto } from '../model/dtos/confirm-buy-request.dto';
import { GetSellOrdersRequestDto } from '../model/dtos/get-sell-orders-request.dto';

@Controller('p2p')
export class P2pController {
  constructor(
    private readonly p2pProvider: P2pProvider,
    private readonly kaspaNetworkActionsService: KaspaNetworkActionsService,
    private readonly config: AppConfigService,
  ) {}

  @Post('getSellOrders')
  async getSellOrders(@Body() body: GetSellOrdersRequestDto): Promise<SellOrderResponseDto[]> {
    try {
      return await this.p2pProvider.listOrders(body);
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
    // const res = await this.kaspaNetworkActionsService.transferKrc20Token(
    //   new PrivateKey(
    //     '0b5d9532d0d8598cce39157129a97fbce8732a72cc2186eb1bcb9426435d3058',
    //   ),
    //   'GILADA',
    //   'kaspatest:qqnvk0l36gn47l2mnktq5m67csmm79wlczva4jcen6xnt6q4z430ccs8dzgzn',
    //   kaspaToSompi('10'),
    //   0n,
    // );

    const res2 = await this.kaspaNetworkActionsService.transferKaspa(
      new PrivateKey('0b5d9532d0d8598cce39157129a97fbce8732a72cc2186eb1bcb9426435d3058'),
      [
        {
          address: 'kaspatest:qqnvk0l36gn47l2mnktq5m67csmm79wlczva4jcen6xnt6q4z430ccs8dzgzn',
          amount: kaspaToSompi('25'),
        },
      ],
      0n,
    );

    console.log('result', res2);

    return 'asd MF';
  }

  @Get('test2')
  async test2() {
    await this.kaspaNetworkActionsService.logMyWallets('before');

    const res = await this.kaspaNetworkActionsService.transferKaspa(
      new PrivateKey('7a41d1df2b0e0a54384da99de1e0bfc76a95abc31bed90dfe8c427b0bef45a1c'),
      [
        {
          address: 'kaspatest:qqvy0kf7yf2dzz0cmsaaf7gdt9nn6dh7ykvztdn9cev5wm0jp6dgv26v7c7mv',
          amount: kaspaToSompi('1'),
        },
        {
          address: 'kaspatest:qqnvk0l36gn47l2mnktq5m67csmm79wlczva4jcen6xnt6q4z430ccs8dzgzn',
          amount: kaspaToSompi('2'),
        },
        {
          address: 'kaspatest:qzaxjq87c3yl8xggv8fl39smmahvl8yusgcrw45equjeu8hfz5wtct9y4n96t',
          amount: kaspaToSompi('3'),
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
  }

  @Get('test4')
  async test4() {
    const res = await this.kaspaNetworkActionsService.doSellSwap(
      new PrivateKey('89ccb3e6969aa3bb48568de3172fd5ae31942ca8cb3aace665931b11cb033cc8'),
      'kaspatest:qqvy0kf7yf2dzz0cmsaaf7gdt9nn6dh7ykvztdn9cev5wm0jp6dgv26v7c7mv',
      'kaspatest:qzaxjq87c3yl8xggv8fl39smmahvl8yusgcrw45equjeu8hfz5wtct9y4n96t',
      'GILADA',
      kaspaToSompi('10'),
      kaspaToSompi('20'),
    );

    console.log('result', res);

    return res;
  }
}
