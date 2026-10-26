import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { EventStatusDto } from './create-event.dto';
import { EventSettingsDto } from './event-settings.dto';

export class UpdateEventDto extends EventSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(190)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(190)
  slug?: string;

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

  @IsOptional()
  @IsString()
  whatsappMessage?: string;

  @IsOptional()
  @IsString()
  whatsappPrizeMessage?: string;

  @IsOptional()
  @IsString()
  whatsappResendMessage?: string;

  @IsOptional()
  @IsString()
  whatsappVipMessage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  whatsappChannelLink?: string;
}
