import { AdminUserId } from '../security/admin-user-id.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Ip,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { AddPrizeQueueDto } from './dto/add-prize-queue.dto';
import { ReorderPrizeQueueDto } from './dto/reorder-prize-queue.dto';
import { SetNextPrizeDto } from './dto/set-next-prize.dto';

import { PrizeQueueService } from './prize-queue.service';

@Controller('prize-queue')
export class PrizeQueueController {
  constructor(private readonly prizeQueueService: PrizeQueueService) {}

  @Post()
  add(
    @Body() dto: AddPrizeQueueDto,
    @AdminUserId() adminUserId: number | null,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.prizeQueueService.add(dto, {
      adminUserId,
      ipAddress,
      userAgent: userAgent ?? null,
    });
  }

  @Get('event/:eventId')
  findByEvent(@Param('eventId', ParseIntPipe) eventId: number) {
    return this.prizeQueueService.findByEvent(eventId);
  }

  @Get('event/:eventId/next')
  getNext(@Param('eventId', ParseIntPipe) eventId: number) {
    return this.prizeQueueService.getNext(eventId);
  }

  @Get('event/:eventId/history')
  history(@Param('eventId', ParseIntPipe) eventId: number) {
    return this.prizeQueueService.history(eventId);
  }

  @Patch('event/:eventId/next')
  setNext(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() dto: SetNextPrizeDto,
    @AdminUserId() adminUserId: number | null,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.prizeQueueService.setNext(eventId, dto, {
      adminUserId,
      ipAddress,
      userAgent: userAgent ?? null,
    });
  }

  @Patch('event/:eventId/reorder')
  reorder(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() dto: ReorderPrizeQueueDto,
    @AdminUserId() adminUserId: number | null,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.prizeQueueService.reorder(eventId, dto, {
      adminUserId,
      ipAddress,
      userAgent: userAgent ?? null,
    });
  }

  @Post('event/:eventId/generate-auto')
  generateAuto(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body('count') count?: number,
    @Body('isVip') isVip?: boolean,
    @Body('clearExisting') clearExisting?: boolean,
    @AdminUserId() adminUserId?: number | null,
    @Ip() ipAddress?: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.prizeQueueService.generateAutoQueue(
      eventId,
      count || 50,
      isVip,
      clearExisting ?? false,
      {
        adminUserId,
        ipAddress,
        userAgent: userAgent ?? null,
      },
    );
  }

  @Delete('event/:eventId/clear')
  clearQueue(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Query('isVip') isVipQuery?: string,
    @AdminUserId() adminUserId?: number | null,
    @Ip() ipAddress?: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const isVip =
      isVipQuery === 'true'
        ? true
        : isVipQuery === 'false'
          ? false
          : undefined;
    return this.prizeQueueService.clearQueue(eventId, isVip, {
      adminUserId,
      ipAddress,
      userAgent: userAgent ?? null,
    });
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @AdminUserId() adminUserId: number | null,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.prizeQueueService.remove(id, {
      adminUserId,
      ipAddress,
      userAgent: userAgent ?? null,
    });
  }
}
