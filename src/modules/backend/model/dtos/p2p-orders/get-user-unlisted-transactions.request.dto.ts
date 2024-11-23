import { IsArray, IsString } from 'class-validator';

export class GetUserUnlistedTransactionsRequestDto {
  @IsArray()
  @IsString({ each: true })
  transactions: string[];
}
