import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { MeetingsService } from './meetings.service';
import { IsDateString, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { hasValidAdminKey } from '../security/admin-mutation.guard';

export class BookMeetingDto {
  // Público: token do link do participante. participantId só via admin-proxy.
  @IsOptional()
  @IsString()
  @MaxLength(128)
  token?: string;

  @IsOptional()
  @IsInt()
  participantId?: number;

  @IsDateString()
  scheduledAt: string;
}

export class UpdateStatusDto {
  status: 'COMPLETED' | 'NO_SHOW' | 'CANCELED';
}

@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Get('event/:eventId/agenda')
  getAgenda(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Query('date') dateString: string,
  ) {
    return this.meetingsService.getAgendaByEvent(eventId, dateString);
  }

  @Post(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) meetingId: number,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.meetingsService.updateMeetingStatus(meetingId, dto.status);
  }

  @Get('event/:eventId/available-slots')
  getAvailableSlots(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Query('date') dateString: string, // YYYY-MM-DD
  ) {
    return this.meetingsService.getAvailableSlots(eventId, dateString);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('event/:eventId/book')
  bookMeeting(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() dto: BookMeetingDto,
    @Req() req: Request,
  ) {
    if (dto.token) {
      return this.meetingsService.bookMeetingByToken(eventId, dto.token, dto.scheduledAt);
    }
    if (!dto.participantId || !hasValidAdminKey(req)) {
      throw new UnauthorizedException('Link de agendamento inválido.');
    }
    return this.meetingsService.bookMeeting(eventId, dto.participantId, dto.scheduledAt);
  }
}
