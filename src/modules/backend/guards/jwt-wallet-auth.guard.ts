import { ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SkipGuardsService } from './infra/skipGuardsService';
import { AllowWithoutWalletService } from './infra/allowWithoutWalletService';

@Injectable()
export class JwtWalletAuthGuard extends AuthGuard('jwt-wallet') {
  @Inject(SkipGuardsService) protected skipGuardsService: SkipGuardsService;
  @Inject(AllowWithoutWalletService) protected allowWithoutWalletService: AllowWithoutWalletService;

  canActivate(context: ExecutionContext) {
    return super.canActivate(context); // Execute the default JWT validation
  }

  handleRequest(err, walletInfo, info, context: ExecutionContext) {
    if (this.skipGuardsService.shouldSkip(context, this.constructor as new (...args: any[]) => any)) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    if (err || (!walletInfo && !this.allowWithoutWalletService.shouldAllowWithoutWallet(context))) {
      throw err || new UnauthorizedException();
    }

    request['walletInfo'] = walletInfo;

    return walletInfo;
  }
}
