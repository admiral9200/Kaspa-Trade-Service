import { CanActivate, ExecutionContext, Inject } from '@nestjs/common';
import { AVOID_GUARD_DATA_KEY } from './avoidGuard';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';

export abstract class BaseGuard implements CanActivate {
  @Inject(Reflector) protected reflector: Reflector;

  protected shouldSkip(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const guradsToSkip = this.reflector.getAllAndOverride(AVOID_GUARD_DATA_KEY, [context.getHandler(), context.getClass()]);

    if (!guradsToSkip || !Array.isArray(guradsToSkip) || !guradsToSkip.length) {
      return false;
    }

    const currentClass = this.constructor;

    return guradsToSkip.includes(currentClass);
  }

  public abstract canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean>;
}
