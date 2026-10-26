import {
  IsEnum,
  IsInt,
  IsOptional,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum EventExperienceDto {
  ROLETA = 'ROLETA',
  COFRE = 'COFRE',
}

// Aparência e integrações do evento (criação e edição). null limpa o campo.
export class EventSettingsDto {
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Cor deve ser #RRGGBB.' })
  accentColor?: string | null;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Cor deve ser #RRGGBB.' })
  accentInkColor?: string | null;

  @IsOptional()
  @IsEnum(EventExperienceDto)
  experience?: EventExperienceDto;

  @IsOptional()
  @Matches(/^\d{10,13}$/, {
    message: 'Telefone de alerta: só dígitos, com DDD (e DDI opcional).',
  })
  alertPhone?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  stockAlertPercent?: number;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  crmWebhookUrl?: string | null;
}
