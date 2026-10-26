import { ArrayMinSize, IsArray, IsInt, Min } from 'class-validator';

export class ReorderPrizeQueueDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(1, { each: true })
  queueIds: number[];
}
