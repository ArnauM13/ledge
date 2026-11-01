import { Prisma } from '../../generated/prisma/client';

/**
 * Business models and the column that ties each row to a household.
 * Every model with household data MUST be listed here (or in
 * HOUSEHOLD_SCOPE_EXEMPT with a reason): a test parses schema.prisma and fails
 * otherwise. Phase 2 tables (accounts, positions...) go here with 'householdId'.
 */
export const HOUSEHOLD_SCOPED_MODELS = {
  Household: 'id',
} as const satisfies Partial<Record<Prisma.ModelName, string>>;

/** Models with a household_id that are deliberately not scoped, and why. */
export const HOUSEHOLD_SCOPE_EXEMPT: Partial<Record<Prisma.ModelName, string>> =
  {
    Membership:
      'Authorization data: it is what decides which households a user can access (read by user_id in the guard and the session endpoint).',
    AuditLog:
      'Append-only security log written by AuditService; household_id is informational and nullable (e.g. failed logins).',
  };

type ScopedModel = keyof typeof HOUSEHOLD_SCOPED_MODELS;

const WHERE_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'delete',
  'deleteMany',
  'upsert',
]);
const CREATE_OPERATIONS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'upsert',
]);

export class UnscopedQueryError extends Error {
  override readonly name = 'UnscopedQueryError';
  constructor(model: string, operation: string) {
    super(
      `${model}.${operation} without a household filter. Use the household-scoped client (@HouseholdDb()) instead.`,
    );
  }
}

export class HouseholdScopeViolationError extends Error {
  override readonly name = 'HouseholdScopeViolationError';
  constructor(model: string, operation: string) {
    super(`${model}.${operation} tried to write data of another household.`);
  }
}

function scopeKey(model: string | undefined): string | undefined {
  return model ? HOUSEHOLD_SCOPED_MODELS[model as ScopedModel] : undefined;
}

type Where = Record<string, unknown> & { AND?: unknown };

function andList(where: Where | undefined): unknown[] {
  if (!where || where.AND === undefined) return [];
  return Array.isArray(where.AND) ? where.AND : [where.AND];
}

function hasScopeFilter(where: Where | undefined, key: string): boolean {
  if (!where) return false;
  const direct = where[key];
  if (typeof direct === 'string' && direct.length > 0) return true;
  return andList(where).some((c) => {
    const value = (c as Where | null)?.[key];
    return typeof value === 'string' && value.length > 0;
  });
}

function createData(
  args: Record<string, unknown>,
  operation: string,
): Record<string, unknown>[] {
  const data = operation === 'upsert' ? args['create'] : args['data'];
  if (data === undefined) return [];
  return (Array.isArray(data) ? data : [data]) as Record<string, unknown>[];
}

/**
 * Installed on the application-wide client: every query on a scoped model must
 * carry its household filter, or it throws. Unscoped reads like
 * `household.findMany()` are impossible by construction.
 */
export const requireHouseholdScope = Prisma.defineExtension({
  name: 'require-household-scope',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const key = scopeKey(model);
        if (key) {
          const a = (args ?? {}) as Record<string, unknown>;
          if (
            WHERE_OPERATIONS.has(operation) &&
            !hasScopeFilter(a['where'] as Where, key)
          ) {
            throw new UnscopedQueryError(model, operation);
          }
          // New business rows must name their household. (Creating a household
          // itself has no such column: `id` is generated.)
          if (key !== 'id' && CREATE_OPERATIONS.has(operation)) {
            if (
              createData(a, operation).some((d) => typeof d[key] !== 'string')
            ) {
              throw new UnscopedQueryError(model, operation);
            }
          }
        }
        return query(args);
      },
    },
  },
});

/**
 * Extension that confines every query on a scoped model to one household:
 * reads, updates and deletes get `AND <key> = householdId`; creates get the
 * household id written in (and refuse a different one). A row of another
 * household is therefore simply "not found".
 */
export function householdScope(householdId: string) {
  return Prisma.defineExtension({
    name: `household-scope`,
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const key = scopeKey(model);
          if (!key) {
            return query(args);
          }
          const a = { ...((args ?? {}) as Record<string, unknown>) };
          if (WHERE_OPERATIONS.has(operation)) {
            const where = (a['where'] ?? {}) as Where;
            a['where'] = {
              ...where,
              AND: [...andList(where), { [key]: householdId }],
            };
          }
          if (CREATE_OPERATIONS.has(operation)) {
            if (key === 'id') {
              throw new HouseholdScopeViolationError(model, operation);
            }
            const fix = (d: Record<string, unknown>) => {
              if (d[key] !== undefined && d[key] !== householdId) {
                throw new HouseholdScopeViolationError(model, operation);
              }
              return { ...d, [key]: householdId };
            };
            if (operation === 'upsert') {
              a['create'] = fix(a['create'] as Record<string, unknown>);
            } else {
              const data = a['data'];
              a['data'] = Array.isArray(data)
                ? data.map(fix)
                : fix(data as Record<string, unknown>);
            }
          }
          if (
            operation === 'update' ||
            operation === 'updateMany' ||
            operation === 'upsert'
          ) {
            // Moving a row to another household is never allowed.
            const data = (operation === 'upsert' ? a['update'] : a['data']) as
              Record<string, unknown> | undefined;
            if (
              data &&
              key !== 'id' &&
              data[key] !== undefined &&
              data[key] !== householdId
            ) {
              throw new HouseholdScopeViolationError(model, operation);
            }
            if (data && key === 'id' && data['id'] !== undefined) {
              throw new HouseholdScopeViolationError(model, operation);
            }
          }
          return query(a as typeof args);
        },
      },
    },
  });
}
