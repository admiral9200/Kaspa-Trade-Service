import { Body, Controller, Get, Param, Post, Query, UseGuards, ValidationPipe } from '@nestjs/common';
import { P2pProvider } from '../providers/p2p.provider';
import { AppLogger } from 'src/modules/core/modules/logger/app-logger.abstract';
import { JwtWalletAuthGuard } from '../guards/jwt-wallet-auth.guard';
import { CreateWithdrawalDto } from '../model/dtos/withdrawals/create-withdrawal.dto';
import { WithdrawalResponseDto } from '../model/dtos/withdrawals/withdrawal.response.dto';
import { WithdrawalProvider } from '../providers/withdrawal.provider';
import { WithdrawalHistoryDto } from '../model/dtos/withdrawals/withdrawal-history.dto';
import { ListedWithdrawalDto } from '../model/dtos/withdrawals/listed-withdrawal.dto';
import { CurrentAuthWalletInfo } from '../guards/jwt-wallet.strategy';
import { AuthWalletInfo } from '../model/dtos/auth/auth-wallet-info';

@Controller('withdrawal')
@UseGuards(JwtWalletAuthGuard)
export class WithdrawalController {
  constructor(
    private readonly withdrawalProvider: WithdrawalProvider,
    private readonly logger: AppLogger,
  ) {}

  @Post('create')
  async createWithdrawal(
    @CurrentAuthWalletInfo() walletInfo: AuthWalletInfo,
    @Body() body: CreateWithdrawalDto
  ): Promise<Partial<WithdrawalResponseDto>> {
    return await this.withdrawalProvider.createWithdrawal(body, walletInfo.walletAddress);
  }



  @Get('histories')
  async getWithdrawalHistory(
    @CurrentAuthWalletInfo() walletInfo: AuthWalletInfo,
    @Query(ValidationPipe) query: WithdrawalHistoryDto  
  ): Promise<{ withdrawals: ListedWithdrawalDto[], totalCount: number }> {
    return await this.withdrawalProvider.getWithdrawalHistory(query, walletInfo.walletAddress);
  }
}
