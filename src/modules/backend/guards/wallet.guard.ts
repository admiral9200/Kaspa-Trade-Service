import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { isEmptyString } from '../utils/object.utils';
import { KaspaNetworkActionsService } from '../services/kaspa-network/kaspa-network-actions.service';
import { AppLoggerService } from 'src/modules/core/modules/logger/app-logger.service';

@Injectable()
export class WalletGuard implements CanActivate {
  constructor(
    protected readonly kaspaNetworkActionsService: KaspaNetworkActionsService,
    protected readonly logger: AppLoggerService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const message = request.cookies['Message'];
    const publicKey = request.cookies['PublicKey'];
    const signature = request.cookies['Signature'];

    if (isEmptyString(message) || isEmptyString(publicKey) || isEmptyString(signature)) {
      throw new UnauthorizedException();
    }

    try {
      const walletAddress = await this.kaspaNetworkActionsService.veryfySignedMessageAndGetWalletAddress(
        message,
        signature,
        publicKey,
      );

      request.wallet = walletAddress;

      if (!walletAddress) {
        throw new UnauthorizedException();
      }
    } catch (error) {
      console.error(error);
      this.logger.error(error?.message, error?.stack);
      throw new UnauthorizedException();
    }

    return true;
  }
}
