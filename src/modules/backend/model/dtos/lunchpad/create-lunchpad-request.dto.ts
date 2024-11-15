import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { MIN_FEE_RATE_PER_TRANSACTION, MIN_KAS_PER_UNIT, MIN_TOKEN_PER_UNIT } from '../../schemas/lunchpad.schema';

export class CreateLunchpadRequestDto {
  @IsString()
  ticker: string;

  @IsNumber()
  @Min(MIN_KAS_PER_UNIT)
  kasPerUnit: number;

  @IsNumber()
  @Min(MIN_TOKEN_PER_UNIT)
  tokenPerUnit: number;

  @IsOptional()
  @IsNumber()
  @Min(MIN_FEE_RATE_PER_TRANSACTION)
  maxFeeRatePerTransaction?: number = MIN_FEE_RATE_PER_TRANSACTION;

  @IsOptional()
  @IsNumber()
  @IsInt()
  minUnitsPerOrder: number = 1;

  @IsOptional()
  @IsNumber()
  @IsInt()
  maxUnitsPerOrder: number = 10;
}
