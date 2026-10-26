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
} from '@nestjs/common';

import { AddWhitelistItemDto } from './dto/add-whitelist-item.dto';
import { UpdateFraudRuleDto } from './dto/update-fraud-rule.dto';
import { FraudRulesService } from './fraud-rules.service';

@Controller('fraud-rules')
export class FraudRulesController {
  constructor(private readonly fraudRulesService: FraudRulesService) {}

  @Get('event/:eventId')
  findByEvent(
    @Param('eventId', ParseIntPipe)
    eventId: number,
  ) {
    return this.fraudRulesService.findByEvent(eventId);
  }

  @Get('event/:eventId/whitelist')
  getWhitelist(
    @Param('eventId', ParseIntPipe)
    eventId: number,
  ) {
    return this.fraudRulesService.getWhitelist(eventId);
  }

  @Post('event/:eventId/whitelist')
  addWhitelistItem(
    @Param('eventId', ParseIntPipe)
    eventId: number,
    @Body()
    dto: AddWhitelistItemDto,
  ) {
    return this.fraudRulesService.addWhitelistItem(eventId, dto);
  }

  @Delete('event/:eventId/whitelist/:itemId')
  removeWhitelistItem(
    @Param('eventId', ParseIntPipe)
    eventId: number,
    @Param('itemId')
    itemId: string,
  ) {
    return this.fraudRulesService.removeWhitelistItem(eventId, itemId);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.fraudRulesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe)
    id: number,

    @Body()
    dto: UpdateFraudRuleDto,

    @AdminUserId()
    adminUserId: number | null,

    @Ip()
    ipAddress: string,

    @Headers('user-agent')
    userAgent?: string,
  ) {
    return this.fraudRulesService.update(id, dto, {
      adminUserId,
      ipAddress,
      userAgent: userAgent ?? null,
    });
  }
}
