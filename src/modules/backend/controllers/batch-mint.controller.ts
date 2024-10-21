import { Body, Controller, Param, Post, Request, UseGuards } from '@nestjs/common';
import { WalletGuard } from '../guards/wallet.guard';
import { BatchMintProvider } from '../providers/batch-mint.provider';
import { CreateBatchMintRequestDto } from '../model/dtos/batch-mint/create-batch-mint-request.dto';

@Controller('batch-mint')
@UseGuards(WalletGuard)
export class BatchMintController {
  constructor(private readonly batchMintProvider: BatchMintProvider) {}

  @Post(':ticker')
  async createBatchMint(@Param('ticker') ticker: string, @Request() req, @Body() body: CreateBatchMintRequestDto): Promise<any> {
    return this.batchMintProvider.createBatchMint(ticker, req.wallet, body);
  }
}
