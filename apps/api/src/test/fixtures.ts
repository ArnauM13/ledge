import { randomUUID } from 'node:crypto';
import { hashPassword } from '../app/auth/password.service';
import type { AppPrismaClient } from '../app/prisma/prisma-client';

export const TEST_PASSWORD = 'a perfectly long test passphrase';

/** A user in a new household (unique email per call). */
export async function createUserWithHousehold(
  prisma: AppPrismaClient,
  householdName = 'Test household',
) {
  const email = `user-${randomUUID()}@example.test`;
  const household = await prisma.household.create({
    data: { name: householdName },
  });
  const user = await prisma.user.create({
    data: {
      email,
      displayName: 'Test user',
      passwordHash: await hashPassword(TEST_PASSWORD),
    },
  });
  await prisma.membership.create({
    data: { householdId: household.id, userId: user.id, role: 'OWNER' },
  });
  return { user, household, email };
}
