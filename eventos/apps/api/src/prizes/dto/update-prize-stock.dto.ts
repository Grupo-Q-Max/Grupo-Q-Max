import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export enum StockOperationDto {
  ADD = 'ADD',
  REMOVE = 'REMOVE',
  SET = 'SET',
}

export class UpdatePrizeStockDto {
  @IsEnum(StockOperationDto)
  operation: StockOperationDto;

  @IsInt()
  @Min(0)
  quantity: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
