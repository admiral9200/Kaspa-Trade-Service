import { IsInt, IsNumber, Max, Min } from 'class-validator';

export class CreateBatchMintRequestDto {
  @IsNumber()
  @Min(0)
  maxPriorityFee: number;

  @IsNumber()
  @IsInt()
  @Min(1)
  @Max(10000)
  amount: number;

  @IsNumber()
  @Min(0)
  stopMintsAtMintsLeft: number;
}
