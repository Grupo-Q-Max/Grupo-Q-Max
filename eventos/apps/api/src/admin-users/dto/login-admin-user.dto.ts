import { IsNotEmpty, IsString } from 'class-validator';

export class LoginAdminUserDto {
  @IsString({ message: 'O usuário/e-mail deve ser um texto.' })
  @IsNotEmpty({ message: 'O usuário ou e-mail é obrigatório.' })
  username!: string;

  @IsString({ message: 'A senha deve ser um texto.' })
  @IsNotEmpty({ message: 'A senha é obrigatória.' })
  password!: string;
}
