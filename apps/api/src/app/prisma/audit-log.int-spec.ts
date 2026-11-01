import { buildDatabaseUrl } from '../config/database-url';
import {
  AppPrismaClient,
  AuditLogAppendOnlyError,
  createPrismaClient,
} from './prisma-client';

describe('audit_logs is append-only', () => {
  let prisma: AppPrismaClient;
  let id: string;

  beforeAll(async () => {
    prisma = createPrismaClient(buildDatabaseUrl());
    const row = await prisma.auditLog.create({
      data: { action: 'test.append_only', outcome: 'SUCCESS' },
    });
    id = row.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('stores timestamps as UTC instants', async () => {
    const row = await prisma.auditLog.findUniqueOrThrow({ where: { id } });
    expect(Math.abs(row.createdAt.getTime() - Date.now())).toBeLessThan(60_000);
    const [{ tz }] = await prisma.$queryRaw<
      { tz: string }[]
    >`SELECT current_setting('TimeZone') AS tz`;
    expect(tz).toBe('UTC');
  });

  it.each([
    [
      'update',
      (p: AppPrismaClient) =>
        p.auditLog.update({ where: { id }, data: { reason: 'x' } }),
    ],
    [
      'updateMany',
      (p: AppPrismaClient) => p.auditLog.updateMany({ data: { reason: 'x' } }),
    ],
    ['delete', (p: AppPrismaClient) => p.auditLog.delete({ where: { id } })],
    ['deleteMany', (p: AppPrismaClient) => p.auditLog.deleteMany({})],
    [
      'upsert',
      (p: AppPrismaClient) =>
        p.auditLog.upsert({
          where: { id },
          create: { action: 'x', outcome: 'SUCCESS' },
          update: { reason: 'x' },
        }),
    ],
  ])('the API client rejects %s', async (_name, op) => {
    await expect(op(prisma)).rejects.toThrow(AuditLogAppendOnlyError);
  });

  it('the database rejects UPDATE, DELETE and TRUNCATE (trigger)', async () => {
    await expect(
      prisma.$executeRaw`UPDATE audit_logs SET reason = 'x' WHERE id = ${id}::uuid`,
    ).rejects.toThrow(/append-only/);
    await expect(
      prisma.$executeRaw`DELETE FROM audit_logs WHERE id = ${id}::uuid`,
    ).rejects.toThrow(/append-only/);
    await expect(prisma.$executeRaw`TRUNCATE audit_logs`).rejects.toThrow(
      /append-only/,
    );
    const row = await prisma.auditLog.findUnique({ where: { id } });
    expect(row?.reason).toBeNull();
  });
});
