import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';

import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  findAll(
    @Query('eventId', new ParseIntPipe({ optional: true }))
    eventId?: number,
  ) {
    return this.auditService.findAll(eventId);
  }
}
