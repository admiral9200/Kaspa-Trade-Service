import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AppConfigService } from 'src/modules/core/modules/config/app-config.service';
import { KaspaNetworkActionsService } from '../services/kaspa-network/kaspa-network-actions.service';
import { AppLogger } from 'src/modules/core/modules/logger/app-logger.abstract';
import { JwtWalletAuthGuard } from './jwt-wallet-auth.guard';
import { AuthWalletInfo } from '../model/dtos/auth/auth-wallet-info';

@Injectable()
export class JwtAdminWalletAuthGuard extends JwtWalletAuthGuard {
  constructor(
    readonly kaspaNetworkActionsService: KaspaNetworkActionsService,
    readonly logger: AppLogger,
    protected readonly config: AppConfigService,
  ) {
    super(kaspaNetworkActionsService, logger);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const hasWallet = await super.canActivate(context);

    if (!hasWallet) {
      throw new UnauthorizedException();
    }

    const request = context.switchToHttp().getRequest();

    const walletInfo: AuthWalletInfo = request.walletInfo;

    if (!this.config.adminWallets.includes(walletInfo.walletAddress)) {
      throw new UnauthorizedException();
    }

    return true;
  }
}
