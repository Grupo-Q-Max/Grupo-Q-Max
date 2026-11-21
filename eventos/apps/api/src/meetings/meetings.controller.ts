import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { MeetingsService } from './meetings.service';
import { IsDateString, IsEmail, IsInt, IsOptional, IsString } from 'class-validator';

export class BookMeetingDto {
  @IsInt()
  participantId: number;

  @IsDateString()
  scheduledAt: string;

  @IsOptional()
  @IsEmail()
  meetingEmail?: string;

  @IsOptional()
  @IsString()
  host?: string;
}

export class UpdateStatusDto {
  status: 'COMPLETED' | 'NO_SHOW' | 'CANCELED';
}

export class RescheduleMeetingDto {
  @IsDateString()
  scheduledAt: string;

  @IsOptional()
  @IsEmail()
  meetingEmail?: string;
}

@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Get('event/:eventId/agenda')
  getAgenda(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Query('date') dateString?: string,
    @Query('host') host?: string,
  ) {
    return this.meetingsService.getAgendaByEvent(eventId, dateString, host);
  }

  @Get('event/:eventId/vip-rewards')
  getVipRewards(@Param('eventId', ParseIntPipe) eventId: number) {
    return this.meetingsService.getVipRewardsByEvent(eventId);
  }

  @Post(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) meetingId: number,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.meetingsService.updateMeetingStatus(meetingId, dto.status);
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post(':id/reschedule')
  rescheduleMeeting(
    @Param('id', ParseIntPipe) meetingId: number,
    @Body() dto: RescheduleMeetingDto,
  ) {
    return this.meetingsService.rescheduleMeeting(meetingId, dto.scheduledAt, dto.meetingEmail);
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post(':id/cancel')
  cancelMeeting(@Param('id', ParseIntPipe) meetingId: number) {
    return this.meetingsService.deleteMeeting(meetingId);
  }

  @Delete(':id')
  deleteMeeting(@Param('id', ParseIntPipe) meetingId: number) {
    return this.meetingsService.deleteMeeting(meetingId);
  }

  @Post('microsoft/:msEventId/reschedule')
  rescheduleMicrosoftMeeting(
    @Param('msEventId') msEventId: string,
    @Body() dto: RescheduleMeetingDto,
  ) {
    return this.meetingsService.rescheduleMicrosoftEventDirect(msEventId, dto.scheduledAt);
  }

  @Delete('microsoft/:msEventId')
  deleteMicrosoftMeeting(@Param('msEventId') msEventId: string) {
    return this.meetingsService.deleteMicrosoftEventDirect(msEventId);
  }

  @Delete('event/:eventId/all')
  deleteAllMeetings(@Param('eventId', ParseIntPipe) eventId: number) {
    return this.meetingsService.deleteAllSiteMeetings(eventId);
  }

  @Get('event/:eventId/available-slots')
  getAvailableSlots(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Query('date') dateString: string, // YYYY-MM-DD
    @Query('host') host?: string,
  ) {
    return this.meetingsService.getAvailableSlots(eventId, dateString, host);
  }

  @Get('event/:eventId/next-slot')
  async getNextSlot(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Query('host') host?: string,
  ) {
    const nextSlot = await this.meetingsService.getNextAvailableSlot(eventId, 7, host);
    return { nextSlot };
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('event/:eventId/book')
  bookMeeting(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() dto: BookMeetingDto,
  ) {
    return this.meetingsService.bookMeeting(
      eventId,
      dto.participantId,
      dto.scheduledAt,
      dto.meetingEmail,
      dto.host,
    );
  }
}
