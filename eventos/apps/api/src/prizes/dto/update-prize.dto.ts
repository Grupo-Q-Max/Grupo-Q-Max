import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdatePrizeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsNumber({
    maxDecimalPlaces: 4,
  })
  @Min(0)
  @Max(100)
  probability?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  isVip?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  availableStock?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  available_stock?: number;
}
