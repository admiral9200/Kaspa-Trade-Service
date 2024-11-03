import { ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SkipGuardsService } from './infra/skipGuardsService';

@Injectable()
export class JwtWalletAuthGuard extends AuthGuard('jwt-wallet') {
  @Inject(SkipGuardsService) protected skipGuardsService: SkipGuardsService;

  canActivate(context: ExecutionContext) {
    return super.canActivate(context); // Execute the default JWT validation
  }

  handleRequest(err, walletInfo, info, context: ExecutionContext) {
    if (this.skipGuardsService.shouldSkip(context, this.constructor as new (...args: any[]) => any)) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    if (err || !walletInfo) {
      throw err || new UnauthorizedException();
    }

    request['walletInfo'] = walletInfo;

    return walletInfo;
  }
}
