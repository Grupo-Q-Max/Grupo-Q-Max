import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class SetNextPrizeDto {
  @IsInt()
  @Min(1)
  prizeId: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
