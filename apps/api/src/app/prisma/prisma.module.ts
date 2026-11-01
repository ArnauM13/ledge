import {
  Inject,
  Injectable,
  Logger,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';
import { buildDatabaseUrl } from '../config/database-url';
import {
  AppPrismaClient,
  BasePrismaClient,
  createAppPrismaClient,
  createBasePrismaClient,
  createHouseholdClient,
  HouseholdPrismaClient,
} from './prisma-client';

/** Injection token for the application client (household filter enforced). */
export const PRISMA = Symbol('PRISMA');
/** Unrestricted client. Not exported from this module on purpose. */
const BASE_PRISMA = Symbol('BASE_PRISMA');

/**
 * Connects at startup. If the database is unreachable the API does not start.
 * Errors are rethrown without the connection URL.
 */
export async function connectPrisma(): Promise<BasePrismaClient> {
  const client = createBasePrismaClient(buildDatabaseUrl());
  try {
    await client.$connect();
    await client.$queryRaw`SELECT 1`;
  } catch (err) {
    const code =
      (err as { code?: string }).code ??
      (err as { cause?: { code?: string } }).cause?.code ??
      'unknown';
    await client.$disconnect().catch(() => undefined);
    throw new Error(`Cannot connect to the database (code: ${code})`);
  }
  return client;
}

/**
 * Hands out clients confined to one household. Only HouseholdGuard calls it,
 * after checking the user's membership.
 */
@Injectable()
export class HouseholdScope {
  constructor(@Inject(BASE_PRISMA) private readonly base: BasePrismaClient) {}

  forHousehold(householdId: string): HouseholdPrismaClient {
    return createHouseholdClient(this.base, householdId);
  }
}

@Injectable()
class PrismaLifecycle implements OnApplicationShutdown {
  constructor(@Inject(BASE_PRISMA) private readonly base: BasePrismaClient) {}

  async onApplicationShutdown(): Promise<void> {
    await this.base.$disconnect();
    new Logger('Prisma').log('Disconnected');
  }
}

@Module({
  providers: [
    { provide: BASE_PRISMA, useFactory: connectPrisma },
    {
      provide: PRISMA,
      useFactory: (base: BasePrismaClient): AppPrismaClient =>
        createAppPrismaClient(base),
      inject: [BASE_PRISMA],
    },
    HouseholdScope,
    PrismaLifecycle,
  ],
  exports: [PRISMA, HouseholdScope],
})
export class PrismaModule {}
