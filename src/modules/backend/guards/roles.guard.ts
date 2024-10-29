import { Injectable, CanActivate, ExecutionContext, Inject, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtWalletAuthGuard } from './jwt-wallet-auth.guard';
import { SetMetadata } from '@nestjs/common';
import { UserRoleService } from '../services/user-role.service';
import { AuthWalletInfo, UserRoleEnum } from '../model/dtos/auth/auth-wallet-info';

const METADATA_KEY = 'allwedWalletAuthRoles';
export const AllowedRoles = (...roles: UserRoleEnum[]) => SetMetadata(METADATA_KEY, roles);

@Injectable()
export class RolesGuard extends JwtWalletAuthGuard implements CanActivate {
  @Inject(Reflector) protected reflector: Reflector;
  @Inject(UserRoleService) protected userRoleService: UserRoleService;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const hasWallet = await super.canActivate(context);

    if (!hasWallet) {
      throw new UnauthorizedException();
    }

    const request = context.switchToHttp().getRequest();

    const walletInfo: AuthWalletInfo = request.walletInfo;

    const roles =
      this.reflector.get<UserRoleEnum[]>(METADATA_KEY, context.getHandler()) ||
      this.reflector.get<UserRoleEnum[]>(METADATA_KEY, context.getClass());

    if (!roles || !roles.length) {
      throw new Error('AllowedRoles needs to be defined');
    }

    if (!walletInfo.userRoles || !walletInfo.userRoles.length) {
      throw new ForbiddenException();
    }

    let isAllowed = false;

    for (const role of roles) {
      if (this.userRoleService.isActionAllowed(role, walletInfo.userRoles)) {
        isAllowed = true;
        break;
      }
    }

    if (!isAllowed) {
      throw new ForbiddenException();
    }

    return true;
  }
}
