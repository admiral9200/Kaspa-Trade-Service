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

    try {
      console.log('request.cookies: ', request.cookies);
      const userJsonData = request.cookies['user'];
      console.log('userJsonData: ', userJsonData);

      if (isEmptyString(userJsonData)) {
        throw new UnauthorizedException();
      }

      const { message, publicKey, signature } = JSON.parse(userJsonData);
      console.log('message: ', message);
      console.log('publicKey: ', publicKey);
      console.log('signature: ', signature);

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
