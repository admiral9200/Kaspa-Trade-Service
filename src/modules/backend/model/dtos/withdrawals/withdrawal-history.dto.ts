import { Type } from "class-transformer";
import { IsOptional, IsString, ValidateNested } from "class-validator";
import { SortDto } from "../abstract/sort.dto";
import { SortDirection } from "../../enums/sort-direction.enum";
import { PaginationDto } from "../abstract/pagination.dto";
import { PAGINATION_LIMIT_DEFAULT } from "src/modules/backend/constants";

export class WithdrawalHistoryDto {
    @ValidateNested()
    @Type(() => SortDto)
    @IsOptional()
    sort: SortDto = {
        direction: SortDirection.DESC
    };

    @ValidateNested()
    @Type(() => PaginationDto)
    @IsOptional()
    pagination: PaginationDto = {
        limit: PAGINATION_LIMIT_DEFAULT
    };

    constructor() {
        this.sort = new SortDto();
        this.pagination = new PaginationDto();
    }
}