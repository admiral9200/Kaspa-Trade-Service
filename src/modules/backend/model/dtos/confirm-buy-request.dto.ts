import { IsString } from 'class-validator';

export class ConfirmBuyRequestDto {
  @IsString()
  transactionId: string;
}
