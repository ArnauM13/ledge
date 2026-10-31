import {
  Inject,
  Injectable,
  Logger,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';
import { buildDatabaseUrl } from '../config/database-url';
import { AppPrismaClient, createPrismaClient } from './prisma-client';

/** Injection token for the (extended) Prisma client. */
export const PRISMA = Symbol('PRISMA');

/**
 * Connects at startup. If the database is unreachable the API does not start.
 * Errors are rethrown without the connection URL.
 */
export async function connectPrisma(): Promise<AppPrismaClient> {
  const client = createPrismaClient(buildDatabaseUrl());
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

@Injectable()
class PrismaLifecycle implements OnApplicationShutdown {
  constructor(@Inject(PRISMA) private readonly prisma: AppPrismaClient) {}

  async onApplicationShutdown(): Promise<void> {
    await this.prisma.$disconnect();
    new Logger('Prisma').log('Disconnected');
  }
}

@Module({
  providers: [{ provide: PRISMA, useFactory: connectPrisma }, PrismaLifecycle],
  exports: [PRISMA],
})
export class PrismaModule {}
