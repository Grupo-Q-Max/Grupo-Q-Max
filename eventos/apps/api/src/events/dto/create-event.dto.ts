import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { EventSettingsDto } from './event-settings.dto';

export enum EventStatusDto {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  CLOSED = 'CLOSED',
  ARCHIVED = 'ARCHIVED',
}

export class CreateEventDto extends EventSettingsDto {
  @IsString()
  @MinLength(3)
  @MaxLength(190)
  name: string;

  @IsString()
  @MinLength(3)
  @MaxLength(190)
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(EventStatusDto)
  status?: EventStatusDto;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsBoolean()
  participationEnabled?: boolean;
}
