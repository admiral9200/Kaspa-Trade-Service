import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { LunchpadEntity, MIN_KAS_PER_UNIT } from '../../schemas/lunchpad.schema';

export class CreateLunchpadRequestDto {
  @IsString()
  ticker: string;

  @IsNumber()
  @Min(MIN_KAS_PER_UNIT)
  kasPerUnit: number;

  @IsNumber()
  tokenPerUnit: number;

  @IsOptional()
  @IsNumber()
  @IsInt()
  minimumUnitsPerOrder?: number;
}

export interface CreateLunchpadResponseDto {
  lunchpad: LunchpadEntity;
  walletAddress: string;
}
