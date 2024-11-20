import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';
import { MIN_FEE_RATE_PER_TRANSACTION, MIN_KAS_PER_UNIT, MIN_TOKEN_PER_UNIT } from '../../schemas/lunchpad.schema';
import { WALLET_ADDRESS_VALIDATION_REGEX } from 'src/modules/backend/constants';
import { Transform } from 'class-transformer';

export class UpdateLunchpadRequestDto {
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

  @IsOptional()
  @IsBoolean()
  useWhitelist: boolean = false;

  @IsOptional()
  @IsString({ each: true })
  @Matches(WALLET_ADDRESS_VALIDATION_REGEX, { each: true, message: 'Each address must be a valid wallet address' })
  @Transform(({ value }) => (Array.isArray(value) ? Array.from(new Set(value)) : value)) // Remove duplicates
  whitelistWalletAddresses?: string[] = [];

  @IsOptional()
  @IsInt()
  maxUnitsPerWallet?: number;
}
