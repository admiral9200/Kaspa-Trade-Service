import { Body, Controller, Get, Post } from '@nestjs/common';
import { P2pProvider } from '../providers/p2p.provider';
import { SellRequestDto } from '../model/dtos/sell-request.dto';
import { BuyRequestDto } from '../model/dtos/buy-request.dto';
import { PrivateKey } from 'libs/kaspa-dev/kaspa';
import { Krc20ActionsService } from '../services/krc20/krc20-actions.service';

@Controller('p2p')
export class P2pController {
  constructor(
    private readonly p2pProvider: P2pProvider,
    private readonly krc20ActionsService: Krc20ActionsService,
  ) {}

  @Post('sell')
  async sellToken(@Body() sellRequestDto: SellRequestDto) {
    return await this.p2pProvider.createSellOrder(sellRequestDto);
  }

  @Post('buy')
  async buyToken(@Body() buyRequestDto: BuyRequestDto) {
    return await this.p2pProvider.buy(buyRequestDto);
  }

  @Get('test')
  async test() {
    const res = await this.krc20ActionsService.transferKrc20Token(
      new PrivateKey(
        '0b5d9532d0d8598cce39157129a97fbce8732a72cc2186eb1bcb9426435d3058',
      ),
      'GILADA',
      'kaspatest:qqnvk0l36gn47l2mnktq5m67csmm79wlczva4jcen6xnt6q4z430ccs8dzgzn',
      1,
      0,
    );
    console.log('result', res);
    return 'asd MF';
  }
}
