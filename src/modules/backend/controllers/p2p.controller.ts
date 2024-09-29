import { Body, Controller, Get, HttpException, HttpStatus, NotFoundException, Param, Post, Query, Request } from '@nestjs/common';
import { P2pProvider } from '../providers/p2p.provider';
import { SellOrderDto } from '../model/dtos/sell-order.dto';
import { SellRequestResponseDto } from '../model/dtos/responses/sell-request.response.dto';
import { ConfirmSellOrderRequestResponseDto } from '../model/dtos/responses/confirm-sell-order-request.response.dto';
import { BuyRequestResponseDto } from '../model/dtos/responses/buy-request.response.dto';
import { ConfirmBuyOrderRequestResponseDto } from '../model/dtos/responses/confirm-buy-order-request.response.dto';
import { kaspaToSompi, PrivateKey } from 'libs/kaspa/kaspa';
import { KaspaNetworkActionsService } from '../services/kaspa-network/kaspa-network-actions.service';
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
import { GetOrdersHistoryDto } from '../model/dtos/get-orders-history.dto';
import { GetOrdersHistoryResponseDto } from '../model/dtos/get-orders-history-response.dto';

const TEST_AMOUNT = kaspaToSompi('20.1818');
@Controller('p2p')
export class P2pController {
  constructor(
    private readonly p2pProvider: P2pProvider,
    private readonly kaspaNetworkActionsService: KaspaNetworkActionsService,
    private readonly config: AppConfigService,
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
      throw error;
    }
  }
  @Post('getUserListings')
  async getListings(@Body() body: GetUserListingsDto): Promise<ListedOrderDto[]> {
    try {
      return await this.p2pProvider.userListings(body);
    } catch (error) {
      throw error;
    }
  }

  @Post('getOrdersHistory')
  async getOrdersHistory(@Body() GetOrdersHistoryDto: GetOrdersHistoryDto): Promise<GetOrdersHistoryResponseDto> {
    try {
      return await this.p2pProvider.getOrdersHistory(GetOrdersHistoryDto);
    } catch (error) {
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

  @Post('removeFromMarketplace/:sellOrderId')
  async removeSellOrderFromMarketplace(
    @Param('sellOrderId') sellOrderId: string,
    @Body() body: RemoveFromMarketplaceRequestDto,
  ): Promise<OffMarketplaceRequestResponseDto> {
    try {
      return await this.p2pProvider.removeSellOrderFromMarketplace(sellOrderId, body.walletAddress);
    } catch (error) {
      throw error;
    }
  }

  @Post('updateSellOrder/:sellOrderId')
  async updateSellOrder(@Param('sellOrderId') sellOrderId: string, @Body() body: UpdateSellOrderDto): Promise<void> {
    try {
      await this.p2pProvider.updateSellOrder(sellOrderId, body);
    } catch (error) {
      throw error;
    }
  }

  @Post('relistSellOrder/:sellOrderId')
  async relistOrder(@Param('sellOrderId') sellOrderId: string, @Body() body: RelistSellOrderDto): Promise<void> {
    try {
      await this.p2pProvider.relistSellOrder(sellOrderId, body);
    } catch (error) {
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
      throw error;
    }
  }

  @Post('releaseBuyLock/:sellOrderId')
  async releaseBuyLock(@Param('sellOrderId') sellOrderId: string): Promise<void> {
    try {
      return await this.p2pProvider.releaseBuyLock(sellOrderId);
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

  @Get('test3/:id')
  async test3(@Param('id') id: string) {
    // return this.kaspaNetworkActionsService.generateMasterWallet();
    // const res = await this.kaspaNetworkActionsService.createWallet();
    // const res = await this.kaspaNetworkActionsService.createAccount();
    // console.log('result', res);
    // return res;

    // return this.kaspaNetworkActionsService.getWalletTotalBalance('kaspatest:qq357v269w74lcp4t803jvqhyxj6y2jmkf00n44unhpcz85tvgzzqkxj3pr84');
    // return await this.kaspaNetworkActionsService.verifyTransactionResultWithKaspaApiAndWalletTotalAmount('212831f997aec88ac1358549deb41436f213428ea08810566ea075be765865ff',
    //   'kaspatest:qpdzgy8gvav58tgjwlxr7sj8fd6888r8l93tvqnkkwk3mhy8phgd5uq3yrpc2',
    //   'kaspatest:qqnvk0l36gn47l2mnktq5m67csmm79wlczva4jcen6xnt6q4z430ccs8dzgzn',
    //   2518180000n,
    // );

    const wallet = await this.kaspaNetworkActionsService.getWalletAccountAtIndex(Number(id));
    return {
      private: wallet.privateKey.toString(),
      public: wallet.address,
    };
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
    for (let i = 0; i < 100; i++) {
      try {
        const p1 = this.kaspaNetworkActionsService.transferKaspa(
          new PrivateKey('0b5d9532d0d8598cce39157129a97fbce8732a72cc2186eb1bcb9426435d3058'),
          [
            {
              address: 'kaspatest:qztdljmsaf5uv69d3qld2u7gzt4t3xkz27m8uu5ta8v5pfuh30gtqc9l7a94u',
              amount: kaspaToSompi('0.2'),
            },
            {
              address: 'kaspatest:qrpycncg0dtghh8f0ueeumawzhvk4hzdlknsj83zclakgs0pyzzw5x4frldsv',
              amount: kaspaToSompi('0.2'),
            },
          ],
          0n,
        );

        const p2 = this.kaspaNetworkActionsService.transferKaspa(
          new PrivateKey('0e2a5d3334fb8ac81ce6ec1d07a303e9e1692849e27e58a1d45767ee3ee05cd9'),
          [
            {
              address: 'kaspatest:qztdljmsaf5uv69d3qld2u7gzt4t3xkz27m8uu5ta8v5pfuh30gtqc9l7a94u',
              amount: kaspaToSompi('0.2'),
            },
            {
              address: 'kaspatest:qrpycncg0dtghh8f0ueeumawzhvk4hzdlknsj83zclakgs0pyzzw5x4frldsv',
              amount: kaspaToSompi('0.2'),
            },
          ],
          0n,
        );

        await Promise.all([p1, p2]);
      } catch (e) {
        console.log('error');
      }
      console.log('finished', i);
    }
  }
}
