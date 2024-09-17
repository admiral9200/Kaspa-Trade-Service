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
    const res = await this.krc20ActionsService.transferKaspa(
      new PrivateKey(
        '0e2a5d3334fb8ac81ce6ec1d07a303e9e1692849e27e58a1d45767ee3ee05cd9',
      ),
      'kaspatest:qpdzgy8gvav58tgjwlxr7sj8fd6888r8l93tvqnkkwk3mhy8phgd5uq3yrpc2',
      20,
      0.01,
    );
    console.log('result', res);
    return 'asd MF';
  }
}
