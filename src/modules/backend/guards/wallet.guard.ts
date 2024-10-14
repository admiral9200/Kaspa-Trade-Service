import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { isEmptyString } from '../utils/object.utils';
import { KaspaNetworkActionsService } from '../services/kaspa-network/kaspa-network-actions.service';
import { AppLogger } from 'src/modules/core/modules/logger/app-logger.abstract';
import { BaseGuard } from './infra/baseGuard';

@Injectable()
export class WalletGuard extends BaseGuard implements CanActivate {
  constructor(
    protected readonly kaspaNetworkActionsService: KaspaNetworkActionsService,
    protected readonly logger: AppLogger,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.shouldSkip(context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    try {
      const userJsonData = request.cookies['user'];

      if (isEmptyString(userJsonData)) {
        throw new UnauthorizedException();
      }

      const { message, publicKey, signature } = JSON.parse(userJsonData);

      if (isEmptyString(message) || isEmptyString(publicKey) || isEmptyString(signature)) {
        throw new UnauthorizedException();
      }

      const walletAddress = await this.kaspaNetworkActionsService.veryfySignedMessageAndGetWalletAddress(
        message,
        signature,
        publicKey,
      );

      console.log('walletAddress for this request: ', walletAddress);
      if (!walletAddress) {
        throw new UnauthorizedException();
      }

      request.wallet = walletAddress;
    } catch (error) {
      console.error(error);
      this.logger.error(error?.message, error?.stack);
      throw new UnauthorizedException();
    }

    return true;
  }
}
