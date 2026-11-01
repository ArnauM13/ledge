import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  HOUSEHOLD_SCOPE_EXEMPT,
  HOUSEHOLD_SCOPED_MODELS,
} from './household-scope';

/** Model names with a `householdId` field, parsed from schema.prisma. */
function modelsWithHouseholdId(): string[] {
  const schema = readFileSync(
    join(__dirname, '../../../prisma/schema.prisma'),
    'utf8',
  );
  const models = [...schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)];
  expect(models.length).toBeGreaterThan(0);
  return models
    .filter(([, , body]) => /^\s+householdId\s/m.test(body))
    .map(([, name]) => name);
}

describe('household scope registry', () => {
  it('every model with householdId is either scoped or explicitly exempt', () => {
    const unlisted = modelsWithHouseholdId().filter(
      (name) =>
        !(name in HOUSEHOLD_SCOPED_MODELS) && !(name in HOUSEHOLD_SCOPE_EXEMPT),
    );
    // A new table with household data must be added to HOUSEHOLD_SCOPED_MODELS.
    expect(unlisted).toEqual([]);
  });

  it('exemptions are justified and few', () => {
    for (const reason of Object.values(HOUSEHOLD_SCOPE_EXEMPT)) {
      expect(reason?.length).toBeGreaterThan(30);
    }
    expect(Object.keys(HOUSEHOLD_SCOPE_EXEMPT).sort()).toEqual([
      'AuditLog',
      'Membership',
    ]);
  });

  it('households themselves are scoped by id', () => {
    expect(HOUSEHOLD_SCOPED_MODELS.Household).toBe('id');
  });
});
