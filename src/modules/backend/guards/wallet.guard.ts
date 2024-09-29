import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class WalletGuard implements CanActivate {
  constructor() {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const wallet = request.headers.authorization; // TO DO

    if (!wallet) {
      throw new UnauthorizedException();
    }

    request['wallet'] = wallet;

    return true;
  }
}
