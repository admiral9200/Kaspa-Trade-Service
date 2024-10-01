import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { WalletGuard } from './wallet.guard';
import { AppConfigService } from 'src/modules/core/modules/config/app-config.service';
import { KaspaNetworkActionsService } from '../services/kaspa-network/kaspa-network-actions.service';
import { AppLoggerService } from 'src/modules/core/modules/logger/app-logger.service';

@Injectable()
export class AdminWalletGuard extends WalletGuard {
  constructor(
    readonly kaspaNetworkActionsService: KaspaNetworkActionsService,
    readonly logger: AppLoggerService,
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

    const wallet = request.wallet;

    if (!this.config.adminWallets.includes(wallet)) {
      throw new UnauthorizedException();
    }

    return true;
  }
}
