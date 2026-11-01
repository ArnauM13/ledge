import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { HouseholdSummary } from '@ledge/shared-types';
import { AuditService } from '../audit/audit.service';
import { AuthedRequest, requestMeta } from '../auth/request-context';
import { PRISMA_NOT_FOUND } from '../prisma/prisma-errors';
import {
  CurrentHousehold,
  HouseholdContext,
  HouseholdGuard,
} from './household.guard';

/**
 * Household-scoped routes. Every query goes through `household.db`, the
 * client confined to the household checked by HouseholdGuard.
 */
@Controller('households/:householdId')
@UseGuards(HouseholdGuard)
export class HouseholdsController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  async get(
    @CurrentHousehold() household: HouseholdContext,
  ): Promise<HouseholdSummary> {
    const row = await household.db.household.findUnique({
      where: { id: household.id },
      select: { id: true, name: true },
    });
    if (!row) {
      throw new NotFoundException();
    }
    return { ...row, role: household.role };
  }

  @Patch()
  async rename(
    @CurrentHousehold() household: HouseholdContext,
    @Body() body: { name?: unknown } | undefined,
    @Req() req: AuthedRequest,
  ): Promise<HouseholdSummary> {
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 100) {
      throw new BadRequestException('name must be 1-100 characters');
    }
    try {
      const row = await household.db.household.update({
        where: { id: household.id },
        data: { name },
        select: { id: true, name: true },
      });
      await this.audit.record({
        action: 'household.rename',
        outcome: 'SUCCESS',
        userId: req.auth?.user.id,
        householdId: household.id,
        ...requestMeta(req),
      });
      return { ...row, role: household.role };
    } catch (err) {
      if ((err as { code?: string }).code === PRISMA_NOT_FOUND) {
        throw new NotFoundException();
      }
      throw err;
    }
  }
}
