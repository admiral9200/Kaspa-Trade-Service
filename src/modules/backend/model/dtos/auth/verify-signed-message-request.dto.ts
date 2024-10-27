import { IsNotEmpty, IsString } from 'class-validator';

export class VerifySignedMessageRequestDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsNotEmpty()
  signature: string;

  @IsString()
  @IsNotEmpty()
  publicKey: string;
}
