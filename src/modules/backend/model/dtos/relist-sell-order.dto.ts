import { IsString } from 'class-validator';

export class RelistSellOrderDto {
  @IsString()
  walletAddress: string;
}
