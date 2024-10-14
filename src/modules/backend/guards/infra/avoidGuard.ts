import { SetMetadata } from '@nestjs/common';
import { BaseGuard } from './baseGuard';

export const AVOID_GUARD_DATA_KEY = 'avoidGuard';
export const AvoidGuards = <T extends new (...args: any[]) => BaseGuard>(guards: T[]) =>
  SetMetadata(AVOID_GUARD_DATA_KEY, guards);
