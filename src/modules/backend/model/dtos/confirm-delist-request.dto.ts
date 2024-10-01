import { IsOptional, IsString } from 'class-validator';

export class ConfirmDelistRequestDto {
  @IsString()
  @IsOptional()
  transactionId?: string;
}
