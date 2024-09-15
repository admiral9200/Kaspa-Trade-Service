import {IsNumber, IsString} from "class-validator";

export class SellRequestDto {
    @IsNumber()
    quantity: number;

    @IsString()
    token: string;

    @IsNumber()
    atPrice: number;

    @IsString()
    walletAddress: string;
}