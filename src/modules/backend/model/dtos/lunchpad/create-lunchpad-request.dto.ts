import { IsString } from 'class-validator';
import { UpdateLunchpadRequestDto } from './update-lunchpad-request.dto';

export class CreateLunchpadRequestDto extends UpdateLunchpadRequestDto {
  @IsString()
  ticker: string;
}
