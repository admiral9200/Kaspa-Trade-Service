import { ExecutionContext, Inject, SetMetadata } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Reflector } from '@nestjs/core';

export const SKIP_GUARDS_DATA_KEY = 'skipGuards';
export const SkipGuards = <T extends new (...args: any[]) => any>(guards: T[]) => SetMetadata(SKIP_GUARDS_DATA_KEY, guards);
export class SkipGuardsService {
  @Inject(Reflector) protected reflector: Reflector;

  shouldSkip(
    context: ExecutionContext,
    currentGuard: new (...args: any[]) => any,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const guradsToSkip = this.reflector.getAllAndOverride(SKIP_GUARDS_DATA_KEY, [context.getHandler(), context.getClass()]);

    if (!guradsToSkip || !Array.isArray(guradsToSkip) || !guradsToSkip.length) {
      return false;
    }

    return guradsToSkip.includes(currentGuard);
  }
}
