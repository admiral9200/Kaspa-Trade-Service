import { IsInt, IsNumber, Min } from 'class-validator';

export class CreateBatchMintRequestDto {
  @IsNumber()
  @Min(0)
  maxPriorityFee: number;

  @IsNumber()
  @IsInt()
  @Min(1)
  amount: number;
}
