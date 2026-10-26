import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AddPrizeQueueDto {
  @IsInt()
  @Min(1)
  eventId: number;

  @IsInt()
  @Min(1)
  prizeId: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  position?: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
