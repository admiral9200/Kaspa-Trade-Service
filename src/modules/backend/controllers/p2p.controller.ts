import {Body, Controller, Post} from '@nestjs/common';
import {P2pProvider} from '../providers/p2p.provider';
import {SellRequestDto} from "../model/dtos/sell-request.dto";

@Controller('example')
export class P2pController {
  constructor(private readonly p2pProvider: P2pProvider) {}

  @Post('sell')
  async sellToken(@Body() sellRequestDto: SellRequestDto) {
    return await this.p2pProvider.createSellOrder(sellRequestDto);
  }
}
