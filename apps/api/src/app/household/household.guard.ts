import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { MembershipRole } from '../../generated/prisma/client';
import type { AuthedRequest } from '../auth/request-context';
import { HouseholdScope, PRISMA } from '../prisma/prisma.module';
import type {
  AppPrismaClient,
  HouseholdPrismaClient,
} from '../prisma/prisma-client';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface HouseholdContext {
  id: string;
  role: MembershipRole;
  /** Client confined to this household. */
  db: HouseholdPrismaClient;
}

type HouseholdRequest = AuthedRequest & { household?: HouseholdContext };

/**
 * For routes under `/households/:householdId/...`. Requires a member of that
 * household; anyone else gets 404 (not 403), so the API does not even confirm
 * that the household exists. Provides the household-scoped client.
 * Runs after the global AuthGuard, so `req.auth` is a full session.
 */
@Injectable()
export class HouseholdGuard implements CanActivate {
  constructor(
    @Inject(PRISMA) private readonly prisma: AppPrismaClient,
    private readonly scope: HouseholdScope,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<HouseholdRequest>();
    const householdId = req.params['householdId'];
    const userId = req.auth?.user.id;
    if (
      !userId ||
      typeof householdId !== 'string' ||
      !UUID_RE.test(householdId)
    ) {
      throw new NotFoundException();
    }
    const membership = await this.prisma.membership.findUnique({
      where: { householdId_userId: { householdId, userId } },
      select: { role: true },
    });
    if (!membership) {
      throw new NotFoundException();
    }
    req.household = {
      id: householdId,
      role: membership.role,
      db: this.scope.forHousehold(householdId),
    };
    return true;
  }
}

/** The current household (set by HouseholdGuard). */
export const CurrentHousehold = createParamDecorator(
  (_data: unknown, context: ExecutionContext): HouseholdContext => {
    const household = context
      .switchToHttp()
      .getRequest<HouseholdRequest>().household;
    if (!household) {
      // Programming error: the route forgot @UseGuards(HouseholdGuard).
      throw new Error('CurrentHousehold used without HouseholdGuard');
    }
    return household;
  },
);
