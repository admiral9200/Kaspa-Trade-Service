import {IsNumber, IsString} from "class-validator";

export class SellRequestDto {
    @IsNumber()
    quantity: number;

    @IsString()
    ticker: string;

    @IsNumber()
    atPrice: number;

    @IsString()
    walletAddress: string;
}