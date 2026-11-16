import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';

import { RegisterParticipantDto } from './dto/register-participant.dto';
import { ParticipantsService } from './participants.service';

@Controller('participants')
export class ParticipantsController {
  constructor(private readonly participantsService: ParticipantsService) {}

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('register')
  register(
    @Body()
    dto: RegisterParticipantDto,

    @Ip()
    ipAddress: string,

    @Headers('user-agent')
    userAgent?: string,

    @Headers('origin')
    origin?: string,
  ) {
    return this.participantsService.register(dto, {
      ipAddress,
      userAgent: userAgent ?? null,
      origin: origin ?? null,
    });
  }

  @Get('event/:eventId')
  findByEvent(
    @Param('eventId', ParseIntPipe)
    eventId: number,
  ) {
    return this.participantsService.findByEvent(eventId);
  }

  @Get('event/:eventId/export-csv')
  async exportCsv(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Res() res: Response,
  ) {
    const csvContent = await this.participantsService.exportCsv(eventId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="leads-evento-${eventId}.csv"`,
    );
    return res.send(csvContent);
  }

  @Get('event/:eventId/export-crm-csv')
  async exportCrmCsv(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Res() res: Response,
  ) {
    const csvContent = await this.participantsService.exportCrmCsv(eventId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="leads-crm-rdstation-evento-${eventId}.csv"`,
    );
    return res.send(csvContent);
  }

  @Get('event/:eventId/export-commercial-csv')
  async exportCommercialCsv(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Res() res: Response,
    @Query('segment') segment?: string,
  ) {
    const csvContent = await this.participantsService.exportCommercialCsv(eventId, segment);
    const suffix = segment && segment !== 'all' ? `-${segment}` : '';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="leads-comercial-segmentado-evento-${eventId}${suffix}.csv"`,
    );
    return res.send(csvContent);
  }

  @Get('pending-draws')
  findPendingDraws(
    @Query('eventId') queryEventId?: string,
    @Body('eventId') bodyEventId?: number,
    @Param('eventId') paramEventId?: number,
  ) {
    const eventId = Number(queryEventId || bodyEventId || paramEventId || 1);
    return this.participantsService.findPendingDraws(eventId);
  }

  @Get(':id/public')
  findPublic(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.participantsService.findPublic(id);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.participantsService.findOne(id);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('validate-whatsapp')
  validateWhatsapp(@Body('token') token: string) {
    return this.participantsService.validateWhatsapp(token);
  }
}
