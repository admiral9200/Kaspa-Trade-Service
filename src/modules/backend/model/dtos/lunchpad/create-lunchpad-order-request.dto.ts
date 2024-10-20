import { IsInt, IsNumber, Min } from 'class-validator';

export class CreateLunchpadOrderRequestDto {
  @IsNumber()
  @IsInt()
  @Min(1)
  units: number;
}
