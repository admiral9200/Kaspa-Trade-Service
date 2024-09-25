import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { AppConfigService } from '../modules/config/app-config.service';
import { NextFunction } from 'express';

@Injectable()
export class ServiceCommunicationMiddleware implements NestMiddleware {
  constructor(private readonly configService: AppConfigService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const privateKey = this.configService.getServiceCommunicationSecretKey;
    const authHeader = req.headers['authorization'];

    if (this.configService.isProduction) {
      if (!authHeader) {
        throw new UnauthorizedException('Missing authorization header');
      }

      if (authHeader !== privateKey) {
        throw new UnauthorizedException('Invalid service communication key');
      }
    }

    next();
  }
}
