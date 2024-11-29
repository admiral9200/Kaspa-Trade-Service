import { IsEnum, IsOptional, IsString } from "class-validator";
import { WithdrawalStatus } from "../../enums/withdrawal-status.enum";

export class CreateWithdrawalDto {
    @IsString()
    amount: string;
    
    @IsString()
    @IsOptional()
    ownerWallet: string;

    @IsString()
    receivingWallet: string;

    @IsEnum(WithdrawalStatus, { message: 'Status must be a valid WithdrawalStatus value' })
    status: WithdrawalStatus
}