import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AllowedRoles, RolesGuard } from '../../guards/roles.guard';
import { AuthWalletInfo, UserRoleEnum } from '../../model/dtos/auth/auth-wallet-info';
import { CurrentAuthWalletInfo } from '../../guards/jwt-wallet.strategy';
import { LunchpadManagementProvider } from '../../providers/management/lunchpad-management.provider';

@Controller('lunchpad-management')
@UseGuards(RolesGuard)
@AllowedRoles(UserRoleEnum.LISTING_MANAGER) // !!!!!!!!!!!!!!!!!!!!!! CHNAGE !!!!!!!!!!!!!!!!!!!!!!!
export class LunchpadManagementController {
  constructor(private readonly lunchpadManagementProvider: LunchpadManagementProvider) {}

  @Post(':id/start-process')
  async startLunchpadProcess(@Param('id') id: string): Promise<any> {
    return await this.lunchpadManagementProvider.startLunchpadProcess(id);
  }

  @Post(':id/private')
  async getPrivateKey(
    @Param('id') id: string,
    @Body('password') password: string,
    @Body('walletType') walletType: string,
    @CurrentAuthWalletInfo() walletInfo: AuthWalletInfo,
  ): Promise<any> {
    return await this.lunchpadManagementProvider.getPrivateKey(id, password, walletType, walletInfo.walletAddress);
  }
}
