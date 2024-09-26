import { IsString } from 'class-validator';

export class RemoveFromMarketplaceRequestDto {
  @IsString()
  walletAddress: string;
}
