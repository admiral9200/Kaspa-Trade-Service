import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { P2pProvider } from '../providers/p2p.provider';
import { AppLogger } from 'src/modules/core/modules/logger/app-logger.abstract';
import { JwtWalletAuthGuard } from '../guards/jwt-wallet-auth.guard';
import { CreateWithdrawalDto } from '../model/dtos/withdrawals/create-withdrawal.dto';
import { WithdrawalResponseDto } from '../model/dtos/withdrawals/withdrawal.response.dto';

@Controller('p2p')
@UseGuards(JwtWalletAuthGuard)
export class WithdrawalController {
  constructor(
    private readonly p2pProvider: P2pProvider,
    private readonly logger: AppLogger,
  ) {}

  @Post('createWithdrawal')
  async createWithdrawal(
    @Body() body: CreateWithdrawalDto
  ): Promise<Partial<WithdrawalResponseDto>> {
    try {
      return await this.p2pProvider.createWithdrawal(body);
    } catch (error) {
      this.logger.error('Error creating a withdrawal', error);
      throw error;
    }
  }


  // There should another function here.
  
}
