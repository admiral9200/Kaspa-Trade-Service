import { ExecutionContext, Inject, SetMetadata } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Reflector } from '@nestjs/core';

export const ALLOW_WIHTOUT_WALLET_DATA_KEY = 'allowWithoutWallet';
export const AllowWithoutWallet = () => SetMetadata(ALLOW_WIHTOUT_WALLET_DATA_KEY, true);
export class AllowWithoutWalletService {
  @Inject(Reflector) protected reflector: Reflector;

  shouldAllowWithoutWallet(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const guradsToSkip = this.reflector.getAllAndOverride(ALLOW_WIHTOUT_WALLET_DATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    return !!guradsToSkip;
  }
}
