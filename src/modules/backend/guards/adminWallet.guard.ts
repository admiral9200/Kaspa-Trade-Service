import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { WalletGuard } from './wallet.guard';
import { AppConfigService } from 'src/modules/core/modules/config/app-config.service';

@Injectable()
export class AdminWalletGuard extends WalletGuard {
  constructor(private readonly config: AppConfigService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const hasWallet = super.canActivate(context);

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
