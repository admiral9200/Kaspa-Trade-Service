import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { P2pProvider } from '../providers/p2p.provider';
import { AppLogger } from 'src/modules/core/modules/logger/app-logger.abstract';
import { JwtWalletAuthGuard } from '../guards/jwt-wallet-auth.guard';
import { CreateWithdrawalDto } from '../model/dtos/withdrawals/create-withdrawal.dto';
import { WithdrawalResponseDto } from '../model/dtos/withdrawals/withdrawal.response.dto';
import { WithdrawalProvider } from '../providers/withdrawal.provider';

@Controller('withdrawal')
@UseGuards(JwtWalletAuthGuard)
export class WithdrawalController {
  constructor(
    private readonly withdrawalProvider: WithdrawalProvider,
    private readonly logger: AppLogger,
  ) {}

  @Post('create')
  async createWithdrawal(
    @Body() body: CreateWithdrawalDto
  ): Promise<Partial<WithdrawalResponseDto>> {
    try {
      return await this.withdrawalProvider.createWithdrawal(body);
    } catch (error) {
      this.logger.error('Error creating a withdrawal', error);
      throw error;
    }
  }


  // There should another function here.
  @Get('histories/:walletAddress')
  async getWithdrawalHistory(
    @Param('walletAddress') walletAddress: string
  ): Promise<string[]> {
    try {
      // return await this.withdrawalProvider.getWithdrawalHistory(walletAddress);
      return;
    } catch (error) {
      this.logger.error('Error getting a list of withdrawals', error);
      throw error;
    }
  }
}
