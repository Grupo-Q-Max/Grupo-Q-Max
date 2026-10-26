import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddWhitelistItemDto {
  @IsString()
  @IsNotEmpty({
    message: 'O identificador é obrigatório (CPF, Telefone, E-mail ou Nome).',
  })
  identifier: string;

  @IsString()
  @IsOptional()
  note?: string;
}
