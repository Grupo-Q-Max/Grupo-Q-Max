import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';

import { DashboardService } from './dashboard.service';
import { EventReportService } from './event-report.service';

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly eventReportService: EventReportService,
  ) {}

  // Relatório pós-evento (admin): funil, por hora e prêmios mais sorteados.
  @Get('event/:eventId/report')
  getEventReport(@Param('eventId', ParseIntPipe) eventId: number) {
    return this.eventReportService.getReport(eventId);
  }

  @Get('event/:eventId')
  getEventDashboard(
    @Param('eventId', ParseIntPipe)
    eventId: number,
  ) {
    return this.dashboardService.getEventDashboard(eventId);
  }

  @Get('event/:eventId/public')
  getPublicEventDashboard(
    @Param('eventId', ParseIntPipe)
    eventId: number,
  ) {
    return this.dashboardService.getPublicEventDashboard(eventId);
  }
}
