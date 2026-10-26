import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreatePrizeDto {
  @IsInt()
  @Min(1)
  eventId: number;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsInt()
  @Min(0)
  initialStock: number;

  @IsNumber({
    maxDecimalPlaces: 4,
  })
  @Min(0)
  @Max(100)
  probability: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  isVip?: boolean;
}
