import { AdminUserId } from '../security/admin-user-id.decorator';
import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';

import { CreatePrizeDto } from './dto/create-prize.dto';
import { UpdatePrizeDto } from './dto/update-prize.dto';
import { UpdatePrizeStockDto } from './dto/update-prize-stock.dto';

import { PrizesService } from './prizes.service';

@Controller('prizes')
export class PrizesController {
  constructor(private readonly prizesService: PrizesService) {}

  @Post()
  create(
    @Body()
    dto: CreatePrizeDto,

    @AdminUserId()
    adminUserId: number | null,

    @Ip()
    ipAddress: string,

    @Headers('user-agent')
    userAgent?: string,
  ) {
    return this.prizesService.create(dto, {
      adminUserId,
      ipAddress,
      userAgent: userAgent ?? null,
    });
  }

  @Get('event/:eventId')
  findByEvent(
    @Param('eventId', ParseIntPipe)
    eventId: number,
  ) {
    return this.prizesService.findByEvent(eventId);
  }

  @Get('event/:eventId/probability-summary')
  probabilitySummary(
    @Param('eventId', ParseIntPipe)
    eventId: number,
  ) {
    return this.prizesService.probabilitySummary(eventId);
  }

  @Get(':id/stock-history')
  stockHistory(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.prizesService.stockHistory(id);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.prizesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe)
    id: number,

    @Body()
    dto: UpdatePrizeDto,

    @AdminUserId()
    adminUserId: number | null,

    @Ip()
    ipAddress: string,

    @Headers('user-agent')
    userAgent?: string,
  ) {
    return this.prizesService.update(id, dto, {
      adminUserId,
      ipAddress,
      userAgent: userAgent ?? null,
    });
  }

  @Post(':id/stock')
  updateStock(
    @Param('id', ParseIntPipe)
    id: number,

    @Body()
    dto: UpdatePrizeStockDto,

    @AdminUserId()
    adminUserId: number | null,

    @Ip()
    ipAddress: string,

    @Headers('user-agent')
    userAgent?: string,
  ) {
    return this.prizesService.updateStock(id, dto, {
      adminUserId,
      ipAddress,
      userAgent: userAgent ?? null,
    });
  }
}
