import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AllowedRoles, RolesGuard } from '../../guards/roles.guard';
import { AuthWalletInfo, UserRoleEnum } from '../../model/dtos/auth/auth-wallet-info';
import { CurrentAuthWalletInfo } from '../../guards/jwt-wallet.strategy';
import { LunchpadManagementProvider } from '../../providers/management/lunchpad-management.provider';
import { LunchpadWalletType } from '../../model/enums/lunchpad-wallet-type.enum';

@Controller('lunchpad-management')
@UseGuards(RolesGuard)
@AllowedRoles(UserRoleEnum.SYS_ADMIN)
export class LunchpadManagementController {
  constructor(private readonly lunchpadManagementProvider: LunchpadManagementProvider) {}

  // @Post(':id/start-process')
  // async startLunchpadProcess(@Param('id') id: string): Promise<any> {
  //   return await this.lunchpadManagementProvider.startLunchpadProcess(id);
  // }

  @Post(':id/private')
  async getPrivateKey(
    @Param('id') id: string,
    @Body('password') password: string,
    @Body('walletType') walletType: LunchpadWalletType,
    @CurrentAuthWalletInfo() walletInfo: AuthWalletInfo,
  ): Promise<any> {
    return await this.lunchpadManagementProvider.getPrivateKey(id, password, walletType, walletInfo.walletAddress);
  }
}
