import { IsString } from 'class-validator';

export class ProcessLunchpadOrderRequestDto {
  @IsString()
  transactionId: string;
}
