import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { BatchMintProvider } from '../providers/batch-mint.provider';
import { CreateBatchMintRequestDto } from '../model/dtos/batch-mint/create-batch-mint-request.dto';
import { JwtWalletAuthGuard } from '../guards/jwt-wallet-auth.guard';
import { CurrentAuthWalletInfo } from '../guards/jwt-wallet.strategy';
import { AuthWalletInfo } from '../model/dtos/auth/auth-wallet-info';

@Controller('batch-mint')
@UseGuards(JwtWalletAuthGuard)
export class BatchMintController {
  constructor(private readonly batchMintProvider: BatchMintProvider) {}

  @Post(':ticker')
  async createBatchMint(
    @Param('ticker') ticker: string,
    @CurrentAuthWalletInfo() authWalletInfo: AuthWalletInfo,
    @Body() body: CreateBatchMintRequestDto,
  ): Promise<any> {
    return this.batchMintProvider.createBatchMint(ticker, authWalletInfo.walletAddress, body);
  }

  @Post(':id/start')
  async startBatchMint(@Param('id') id: string, @CurrentAuthWalletInfo() authWalletInfo: AuthWalletInfo): Promise<any> {
    return await this.batchMintProvider.doBatchMint(id, authWalletInfo.walletAddress);
  }
}
