import { IsOptional, IsString } from "class-validator";

export class CreateWithdrawalDto {
    @IsString()
    amount: string;
    
    @IsString()
    @IsOptional()
    ownerWallet: string;

    @IsString()
    receivingWallet: string;
}