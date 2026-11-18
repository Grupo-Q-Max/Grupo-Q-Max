import { ArrayMinSize, IsArray, IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class ReorderPrizeQueueDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(1, { each: true })
  queueIds: number[];

  @IsOptional()
  @IsBoolean()
  isVip?: boolean;
}
