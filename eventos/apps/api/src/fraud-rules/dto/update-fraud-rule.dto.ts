import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum FraudActionDto {
  BLOCK = 'BLOCK',
  REVIEW = 'REVIEW',
  ALLOW_WITH_ALERT = 'ALLOW_WITH_ALERT',
}

export class UpdateFraudRuleDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  maxAllowed?: number;

  @IsOptional()
  @IsEnum(FraudActionDto)
  action?: FraudActionDto;

  @IsOptional()
  @IsString()
  description?: string;
}
