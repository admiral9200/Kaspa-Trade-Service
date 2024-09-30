import { IsOptional, IsString } from 'class-validator';

export class ConfirmDelistRequestDto {
  @IsString()
  walletAddress: string;

  @IsString()
  @IsOptional()
  transactionId?: string;
}
