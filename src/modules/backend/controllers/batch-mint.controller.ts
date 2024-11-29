import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { BatchMintProvider } from '../providers/batch-mint.provider';
import { CreateBatchMintRequestDto } from '../model/dtos/batch-mint/create-batch-mint-request.dto';
import { JwtWalletAuthGuard } from '../guards/jwt-wallet-auth.guard';
import { CurrentAuthWalletInfo } from '../guards/jwt-wallet.strategy';
import { AuthWalletInfo } from '../model/dtos/auth/auth-wallet-info';
import {
  BatchMintTransformer,
  ClientSideBatchMintListWithStatus,
  ClientSideBatchMintWithStatus,
} from '../transformers/batch-mint.transformer';
import { GetBatchMintUserListDto } from '../model/dtos/batch-mint/get-batch-mint-user-list';

@Controller('batch-mint')
@UseGuards(JwtWalletAuthGuard)
export class BatchMintController {
  constructor(private readonly batchMintProvider: BatchMintProvider) {}

  @Post(':ticker/create')
  async createBatchMint(
    @Param('ticker') ticker: string,
    @CurrentAuthWalletInfo() authWalletInfo: AuthWalletInfo,
    @Body() body: CreateBatchMintRequestDto,
  ): Promise<ClientSideBatchMintWithStatus> {
    const result = await this.batchMintProvider.createBatchMint(ticker, authWalletInfo.walletAddress, body);

    return BatchMintTransformer.transformBatchMintDataWithStatusToClientSide(result);
  }

  @Post(':ticker/estimate')
  async estimateTokensAmount(
    @Body() body: CreateBatchMintRequestDto,
  ): Promise<{ success: boolean; requiredKaspaAmount: number }> {
    return (await this.batchMintProvider.getBatchMintRequiredKaspa(body)) as { success: boolean; requiredKaspaAmount: number };
  }

  @Post(':id/start')
  async startBatchMint(
    @Param('id') id: string,
    @CurrentAuthWalletInfo() authWalletInfo: AuthWalletInfo,
  ): Promise<ClientSideBatchMintWithStatus> {
    const result = await this.batchMintProvider.validateAndStartBatchMintPod(id, authWalletInfo.walletAddress);

    return BatchMintTransformer.transformBatchMintDataWithStatusToClientSide(result);
  }

  @Post(':id/validate')
  async validateBatchMintKaspaAmount(
    @Param('id') id: string,
    @CurrentAuthWalletInfo() authWalletInfo: AuthWalletInfo,
  ): Promise<{ success: boolean; isValid: boolean }> {
    return {
      success: true,
      isValid: await this.batchMintProvider.checkIfWalletHasValidKaspaAmount(id, authWalletInfo.walletAddress),
    };
  }

  @Post(':id/cancel')
  async cancelBatchMint(
    @Param('id') id: string,
    @CurrentAuthWalletInfo() authWalletInfo: AuthWalletInfo,
  ): Promise<ClientSideBatchMintWithStatus> {
    const result = await this.batchMintProvider.cancelBatchMint(id, authWalletInfo.walletAddress);

    return BatchMintTransformer.transformBatchMintDataWithStatusToClientSide(result);
  }

  @Post('list')
  async getWalletBatchMints(
    @CurrentAuthWalletInfo() authWalletInfo: AuthWalletInfo,
    @Body() getBatchMintUserListDto: GetBatchMintUserListDto,
  ): Promise<ClientSideBatchMintListWithStatus> {
    const batchMints = await this.batchMintProvider.getBatchMintsByWallet(authWalletInfo.walletAddress, getBatchMintUserListDto);
    return BatchMintTransformer.transformBatchMintListDataWithStatusToClientSide(batchMints);
  }
}
