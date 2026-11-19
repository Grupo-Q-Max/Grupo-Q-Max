import {
  Equals,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class RegisterParticipantDto {
  @IsInt()
  @Min(1)
  eventId: number;

  @IsString()
  @MinLength(3)
  @MaxLength(190)
  fullName: string;

  @IsOptional()
  @IsBoolean()
  isForeigner?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  countryCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  foreignDocument?: string;

  @IsString()
  @MinLength(4)
  @MaxLength(50)
  cpf: string;

  @IsString()
  @MinLength(7)
  @MaxLength(30)
  phone: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(190)
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  croNumber?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  croState?: string;

  @IsOptional()
  @IsString()
  @MaxLength(190)
  clinicName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  state?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  chairsCount?: number;

  @IsString()
  @MinLength(8)
  @MaxLength(190)
  deviceId: string;

  // Gerado no aparelho: reenviar o mesmo cadastro (fila offline) não duplica.
  @IsOptional()
  @IsUUID()
  clientRequestId?: string;

  @IsBoolean()
  marketingConsent: boolean;

  @IsBoolean()
  @Equals(true, {
    message: 'É necessário aceitar a política de privacidade.',
  })
  privacyConsent: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  vipCode?: string;
}
