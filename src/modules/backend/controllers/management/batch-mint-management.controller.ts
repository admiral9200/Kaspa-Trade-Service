import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AllowedRoles, RolesGuard } from '../../guards/roles.guard';
import { AuthWalletInfo, UserRoleEnum } from '../../model/dtos/auth/auth-wallet-info';
import { BatchMintManagementProvider } from '../../providers/management/batch-mint-management.provider';
import { CurrentAuthWalletInfo } from '../../guards/jwt-wallet.strategy';

@Controller('batch-mint-management')
@UseGuards(RolesGuard)
@AllowedRoles(UserRoleEnum.SYS_ADMIN)
export class BatchMintManagementController {
  constructor(private readonly batchMintManagementProvider: BatchMintManagementProvider) {}

  @Post(':id/start-pod')
  async startBatchMint(@Param('id') id: string): Promise<any> {
    return await this.batchMintManagementProvider.startBatchMintPod(id);
  }

  @Post(':id/private')
  async getPrivateKey(
    @Param('id') id: string,
    @Body('password') password: string,
    @CurrentAuthWalletInfo() walletInfo: AuthWalletInfo,
  ): Promise<any> {
    return await this.batchMintManagementProvider.getPrivateKey(id, password, walletInfo.walletAddress);
  }
}
