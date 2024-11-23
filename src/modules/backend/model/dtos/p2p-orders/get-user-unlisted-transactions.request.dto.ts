import { IsArray, IsString } from 'class-validator';
import * as _ from 'lodash';

export class GetUserUnlistedTransactionsRequestDto {
  @IsArray()
  @IsString({ each: true })
  transactions: string[];
}
