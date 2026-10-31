import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../../generated/prisma/client';

/** Raised when the API code tries to change an audit log row. */
export class AuditLogAppendOnlyError extends Error {
  override readonly name = 'AuditLogAppendOnlyError';
  constructor(operation: string) {
    super(`audit_logs is append-only: ${operation} is not allowed`);
  }
}

const forbidden = (operation: string) => (): never => {
  throw new AuditLogAppendOnlyError(operation);
};

/**
 * audit_logs is append-only. These hooks make every update/delete on the
 * model throw before reaching the database (a trigger also rejects them).
 */
export const auditLogAppendOnly = Prisma.defineExtension({
  name: 'audit-log-append-only',
  query: {
    auditLog: {
      update: forbidden('update'),
      updateMany: forbidden('updateMany'),
      updateManyAndReturn: forbidden('updateManyAndReturn'),
      upsert: forbidden('upsert'),
      delete: forbidden('delete'),
      deleteMany: forbidden('deleteMany'),
    },
  },
});

/**
 * Creates the Prisma client. `connectionString` contains the password: it is
 * handed to the pg pool and never logged. `errorFormat: 'minimal'` keeps query
 * arguments (hashes, ciphertexts) out of error messages.
 */
export function createPrismaClient(connectionString: string) {
  const adapter = new PrismaPg({
    connectionString,
    // Session time zone UTC: timestamptz values are always rendered in UTC.
    options: '-c TimeZone=UTC',
    max: 10,
  });
  return new PrismaClient({ adapter, errorFormat: 'minimal' }).$extends(
    auditLogAppendOnly,
  );
}

export type AppPrismaClient = ReturnType<typeof createPrismaClient>;
