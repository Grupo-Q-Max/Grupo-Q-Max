import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { MeetingsService } from './meetings.service';
import { IsDateString, IsInt } from 'class-validator';

export class BookMeetingDto {
  @IsInt()
  participantId: number;

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

  @Get('event/:eventId/next-slot')
  async getNextSlot(@Param('eventId', ParseIntPipe) eventId: number) {
    const nextSlot = await this.meetingsService.getNextAvailableSlot(eventId, 7);
    return { nextSlot };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('event/:eventId/book')
  bookMeeting(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() dto: BookMeetingDto,
  ) {
    return this.meetingsService.bookMeeting(eventId, dto.participantId, dto.scheduledAt);
  }
}
