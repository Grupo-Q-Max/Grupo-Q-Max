import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { LoginAdminUserDto } from './dto/login-admin-user.dto';

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Gera o hash seguro da senha com scrypt e salt aleatório
   */
  hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  /**
   * Valida a senha fornecida contra o hash armazenado
   */
  verifyPassword(password: string, storedHash: string): boolean {
    try {
      // Suporte a formato salt:hash
      if (storedHash.includes(':')) {
        const [salt, key] = storedHash.split(':');
        const keyBuffer = Buffer.from(key, 'hex');
        const calculatedBuffer = crypto.scryptSync(password, salt, 64);
        return (
          keyBuffer.length === calculatedBuffer.length &&
          crypto.timingSafeEqual(keyBuffer, calculatedBuffer)
        );
      }

      // Suporte a hash simples legado
      const legacySalt = process.env.FINORA_ADMIN_PASSWORD_SALT;
      if (!legacySalt) {
        return false;
      }
      const calculatedBuffer = crypto.scryptSync(password, legacySalt, 64);
      const storedBuffer = Buffer.from(storedHash, 'hex');
      return (
        storedBuffer.length === calculatedBuffer.length &&
        crypto.timingSafeEqual(storedBuffer, calculatedBuffer)
      );
    } catch {
      return false;
    }
  }

  /**
   * Realiza a autenticação de login de um administrador
   */
  async login(dto: LoginAdminUserDto) {
    const usernameOrEmail = dto.username.trim().toLowerCase();
    const password = dto.password;

    const user = await this.prisma.admin_users.findFirst({
      where: {
        OR: [{ email: usernameOrEmail }, { name: usernameOrEmail }],
      },
    });

    if (!user || !this.verifyPassword(password, user.password_hash)) {
      throw new UnauthorizedException('Usuário ou senha incorretos.');
    }

    if (!user.active) {
      throw new UnauthorizedException(
        'Esta conta de administrador está desativada.',
      );
    }

    await this.prisma.admin_users.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }

  /**
   * Lista todos os administradores cadastrados
   */
  async findAll() {
    const users = await this.prisma.admin_users.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        last_login_at: true,
        created_at: true,
      },
      orderBy: { id: 'asc' },
    });

    return users;
  }

  /**
   * Cria um novo administrador no sistema
   */
  async create(dto: CreateAdminUserDto, creatorAdminId?: number | null) {
    const email = dto.email.trim().toLowerCase();

    const existing = await this.prisma.admin_users.findUnique({
      where: { email },
    });

    if (existing) {
      throw new ConflictException(
        'Já existe um administrador cadastrado com este e-mail.',
      );
    }

    const passwordHash = this.hashPassword(dto.password);

    const newUser = await this.prisma.admin_users.create({
      data: {
        name: dto.name.trim(),
        email,
        password_hash: passwordHash,
        role: dto.role || 'ADMIN',
        active: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        created_at: true,
      },
    });

    // Registra na auditoria
    await this.prisma.audit_logs.create({
      data: {
        admin_user_id: creatorAdminId ?? null,
        actor_type: 'ADMIN',
        action: 'ADMIN_USER_CREATED',
        entity_type: 'ADMIN_USER',
        entity_id: String(newUser.id),
        description: `Novo administrador criado: ${newUser.name} (${newUser.email}) com perfil ${newUser.role}.`,
      },
    });

    return newUser;
  }

  /**
   * Ativa ou desativa um administrador
   */
  async toggleActive(id: number, creatorAdminId?: number | null) {
    const user = await this.prisma.admin_users.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('Administrador não encontrado.');
    }

    const updated = await this.prisma.admin_users.update({
      where: { id },
      data: {
        active: !user.active,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
      },
    });

    await this.prisma.audit_logs.create({
      data: {
        admin_user_id: creatorAdminId ?? null,
        actor_type: 'ADMIN',
        action: updated.active
          ? 'ADMIN_USER_ACTIVATED'
          : 'ADMIN_USER_DEACTIVATED',
        entity_type: 'ADMIN_USER',
        entity_id: String(id),
        description: `Administrador ${user.name} (${user.email}) foi ${updated.active ? 'ativado' : 'desativado'}.`,
      },
    });

    return updated;
  }

  /**
   * Redefine a senha de um administrador
   */
  async resetPassword(
    id: number,
    newPassword: string,
    creatorAdminId?: number | null,
  ) {
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException(
        'A nova senha deve ter no mínimo 6 caracteres.',
      );
    }

    const user = await this.prisma.admin_users.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('Administrador não encontrado.');
    }

    const passwordHash = this.hashPassword(newPassword);

    await this.prisma.admin_users.update({
      where: { id },
      data: {
        password_hash: passwordHash,
      },
    });

    await this.prisma.audit_logs.create({
      data: {
        admin_user_id: creatorAdminId ?? null,
        actor_type: 'ADMIN',
        action: 'ADMIN_PASSWORD_RESET',
        entity_type: 'ADMIN_USER',
        entity_id: String(id),
        description: `Senha do administrador ${user.name} (${user.email}) foi redefinida.`,
      },
    });

    return {
      success: true,
      message: `Senha de ${user.name} redefinida com sucesso.`,
    };
  }
}
