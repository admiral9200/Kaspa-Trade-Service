import { Injectable } from '@nestjs/common';
import { UserRoleEnum } from '../model/dtos/auth/auth-wallet-info';

@Injectable()
export class UserRoleService {
  constructor() {}

  isActionAllowed(requiredRole: UserRoleEnum, userRoles: UserRoleEnum[]) {
    return userRoles.includes(requiredRole) || userRoles.includes(UserRoleEnum.SYS_ADMIN);
  }
}
