import { createParamDecorator, ExecutionContext, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { AppConfigService } from 'src/modules/core/modules/config/app-config.service';
import { AuthWalletInfo } from '../model/dtos/auth/auth-wallet-info';

export const CurrentAuthWalletInfo = createParamDecorator((data: unknown, ctx: ExecutionContext): AuthWalletInfo => {
  const request = ctx.switchToHttp().getRequest();
  return request.walletInfo;
});

@Injectable()
export class JwtWalletStrategy extends PassportStrategy(Strategy, 'jwt-wallet') {
  constructor(config: AppConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([(req: Request) => req?.cookies && req.cookies['access_token']]),
      ignoreExpiration: false,
      secretOrKey: config.jwtSecretKey,
    });
  }

  async validate(payload: any) {
    return payload; // Return true to indicate validation success
  }
}
