import {IsUUID} from "class-validator";

export class BuyRequestDto {
    @IsUUID()
    id: string;
}