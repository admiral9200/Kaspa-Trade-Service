import { Body, Controller, Get, Post } from '@nestjs/common';
import { P2pProvider } from '../providers/p2p.provider';
import { SellRequestDto } from '../model/dtos/sell-request.dto';
import { BuyRequestDto } from '../model/dtos/buy-request.dto';
import { kaspaToSompi, PrivateKey } from 'libs/kaspa-dev/kaspa';
import { KaspaNetworkActionsService } from '../services/kaspa-network/kaspa-network-actions.service';

@Controller('p2p')
export class P2pController {
  constructor(
    private readonly p2pProvider: P2pProvider,
    private readonly kaspaNetworkActionsService: KaspaNetworkActionsService,
  ) {}

  @Post('sell')
  async sellToken(@Body() sellRequestDto: SellRequestDto) {
    return await this.p2pProvider.createSellOrder(sellRequestDto);
  }

  @Post('buy')
  async buyToken(@Body() buyRequestDto: BuyRequestDto) {
    return await this.p2pProvider.buy(buyRequestDto);
  }

  @Get('feeRate')
  async getFeeRate() {
    return await this.p2pProvider.getCurrentFeeRate();
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
      new PrivateKey(
        '0b5d9532d0d8598cce39157129a97fbce8732a72cc2186eb1bcb9426435d3058',
      ),
      [
        {
          address:
            'kaspatest:qqnvk0l36gn47l2mnktq5m67csmm79wlczva4jcen6xnt6q4z430ccs8dzgzn',
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
      new PrivateKey(
        '7a41d1df2b0e0a54384da99de1e0bfc76a95abc31bed90dfe8c427b0bef45a1c',
      ),
      [
        {
          address:
            'kaspatest:qqvy0kf7yf2dzz0cmsaaf7gdt9nn6dh7ykvztdn9cev5wm0jp6dgv26v7c7mv',
          amount: kaspaToSompi('0.2'),
        },
        {
          address:
            'kaspatest:qqnvk0l36gn47l2mnktq5m67csmm79wlczva4jcen6xnt6q4z430ccs8dzgzn',
          amount: kaspaToSompi('0.25'),
        },
        {
          address:
            'kaspatest:qzaxjq87c3yl8xggv8fl39smmahvl8yusgcrw45equjeu8hfz5wtct9y4n96t',
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
    // const res = await this.kaspaNetworkActionsService.createWallet();
    const res = await this.kaspaNetworkActionsService.createAccount(
      'eyebrow vintage fantasy boost enrich demand chat vehicle myth just chuckle hungry century asthma float candy boss asthma silver sleep spend maple bracket rude',
    );

    console.log('result', res);

    return res;
  }

  @Get('test4')
  async test4() {
    const res = await this.kaspaNetworkActionsService.doSellSwap(
      new PrivateKey(
        '89ccb3e6969aa3bb48568de3172fd5ae31942ca8cb3aace665931b11cb033cc8',
      ),
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
