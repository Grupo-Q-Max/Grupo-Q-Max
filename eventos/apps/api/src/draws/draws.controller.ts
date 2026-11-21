import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Ip,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { DrawsService } from './draws.service';
import { AdminUserId } from '../security/admin-user-id.decorator';

@Controller('draws')
export class DrawsController {
  constructor(private readonly drawsService: DrawsService) {}

  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  @Post('participation/:participationId')
  draw(
    @Param('participationId', ParseIntPipe)
    participationId: number,

    @Ip()
    ipAddress: string,

    @Headers('user-agent')
    userAgent?: string,
  ) {
    return this.drawsService.draw(participationId, {
      ipAddress,
      userAgent: userAgent ?? null,
    });
  }

  @Get('event/:eventId/premiacoes')
  getEventPremiacoes(@Param('eventId', ParseIntPipe) eventId: number) {
    return this.drawsService.getEventPremiacoes(eventId);
  }

  @Post('event/:eventId/participant/:participantId/assign')
  assignParticipantPrizes(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Param('participantId', ParseIntPipe) participantId: number,
    @Body()
    body: {
      normalPrizeId?: number | null;
      vipPrizeId?: number | null;
      customNormalPrizeName?: string;
      customVipPrizeName?: string;
      markDelivered?: boolean;
    },
    @AdminUserId() adminUserId: number | null,
  ) {
    return this.drawsService.assignParticipantPrizes(
      eventId,
      participantId,
      body,
      adminUserId,
    );
  }

  @Get('event/:eventId')
  findByEvent(
    @Param('eventId', ParseIntPipe)
    eventId: number,
  ) {
    return this.drawsService.findByEvent(eventId);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.drawsService.findOne(id);
  }

  @Post('participation/:participationId/claim')
  claimPrize(
    @Param('participationId', ParseIntPipe)
    participationId: number,
    @AdminUserId()
    adminUserId: number | null,
    @Ip()
    ipAddress: string,
    @Headers('user-agent')
    userAgent?: string,
  ) {
    return this.drawsService.claimPrize(participationId, adminUserId, {
      ipAddress,
      userAgent: userAgent ?? null,
    });
  }

  @Get('participation/:participationId/verify-claim')
  verifyClaim(
    @Param('participationId', ParseIntPipe)
    participationId: number,
  ) {
    return this.drawsService.verifyClaim(participationId);
  }

  // Balcão offline: lista de retiradas pendentes para conferir sem internet.
  @Get('event/:eventId/pending-claims')
  pendingClaims(@Param('eventId', ParseIntPipe) eventId: number) {
    return this.drawsService.pendingClaims(eventId);
  }

  @Get('event/:eventId/eligible-grand-draw')
  getEligibleForGrandDraw(
    @Param('eventId', ParseIntPipe)
    eventId: number,
  ) {
    return this.drawsService.getEligibleForGrandDraw(eventId);
  }

  @Post('event/:eventId/grand-draw')
  performGrandDraw(
    @Param('eventId', ParseIntPipe)
    eventId: number,
    @Body('prizeName')
    prizeName?: string,
    @Body('quantity')
    quantity?: number,
    @Body('description')
    description?: string,
  ) {
    return this.drawsService.performGrandDraw(
      eventId,
      prizeName,
      quantity,
      description,
    );
  }

  @Get('event/:eventId/grand-draw-history')
  getGrandDrawHistory(
    @Param('eventId', ParseIntPipe)
    eventId: number,
  ) {
    return this.drawsService.getGrandDrawHistory(eventId);
  }

  @Post('event/:eventId/grand-draw/:participantId/claim')
  claimGrandPrize(
    @Param('eventId', ParseIntPipe)
    eventId: number,
    @Param('participantId', ParseIntPipe)
    participantId: number,
  ) {
    return this.drawsService.claimGrandPrize(eventId, participantId);
  }

  @Delete('event/:eventId/grand-draw/history')
  resetGrandDrawHistory(
    @Param('eventId', ParseIntPipe)
    eventId: number,
  ) {
    return this.drawsService.resetGrandDrawHistory(eventId);
  }
}
