import { IsString } from 'class-validator';

export class ConfirmDelistRequestDto {
  @IsString()
  transactionId?: string;

  @IsString()
  walletAddress: string;
}
