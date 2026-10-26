import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdminMutationGuard } from '../security/admin-mutation.guard';
import { AdminUserId } from '../security/admin-user-id.decorator';
import { AdminUsersService } from './admin-users.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { LoginAdminUserDto } from './dto/login-admin-user.dto';

@Controller('admin-users')
@UseGuards(AdminMutationGuard)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  async login(@Body() dto: LoginAdminUserDto) {
    return this.adminUsersService.login(dto);
  }

  @Get()
  async findAll() {
    return this.adminUsersService.findAll();
  }

  @Post()
  async create(
    @Body() dto: CreateAdminUserDto,
    @AdminUserId() creatorAdminId?: number | null,
  ) {
    return this.adminUsersService.create(dto, creatorAdminId);
  }

  @Patch(':id/toggle-active')
  async toggleActive(
    @Param('id', ParseIntPipe) id: number,
    @AdminUserId() creatorAdminId?: number | null,
  ) {
    return this.adminUsersService.toggleActive(id, creatorAdminId);
  }

  @Patch(':id/reset-password')
  async resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body('password') password: string,
    @AdminUserId() creatorAdminId?: number | null,
  ) {
    return this.adminUsersService.resetPassword(id, password, creatorAdminId);
  }
}
