import {IsString, IsUUID} from "class-validator";

export class BuyRequestDto {
    @IsString()
    walletAddress: string;
}