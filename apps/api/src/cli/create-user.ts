/**
 * Creates a user (there is no public sign-up). The password is read from
 * stdin only: never as an argument or an environment variable.
 *
 *   node create-user.js --email a@example.com --name "A" --household-name "Casa"
 *   node create-user.js --email b@example.com --name "B" --household-id <uuid>
 *
 * In Docker:  docker compose run --rm -it api node create-user.js --email ...
 * TOTP is enrolled on the user's first login (mandatory).
 */
import { hashPassword, passwordProblem } from '../app/auth/password.service';
import { buildDatabaseUrl } from '../app/config/database-url';
import { createPrismaClient } from '../app/prisma/prisma-client';
import { parseCreateUserArgs } from './create-user-args';
import { readPassword } from './read-password';

async function main(): Promise<void> {
  const args = parseCreateUserArgs(process.argv.slice(2));
  const password = await readPassword();
  const problem = passwordProblem(password, args.email);
  if (problem) {
    throw new Error(`Password rejected: ${problem}.`);
  }
  const passwordHash = await hashPassword(password);

  const prisma = createPrismaClient(buildDatabaseUrl());
  try {
    const result = await prisma.$transaction(async (tx) => {
      const household = args.householdId
        ? await tx.household.findUnique({ where: { id: args.householdId } })
        : await tx.household.create({
            data: { name: args.householdName as string },
          });
      if (!household) {
        throw new Error('Household not found.');
      }
      const existing = await tx.membership.count({
        where: { householdId: household.id },
      });
      const user = await tx.user.create({
        data: { email: args.email, displayName: args.name, passwordHash },
      });
      await tx.membership.create({
        data: {
          householdId: household.id,
          userId: user.id,
          role: existing === 0 ? 'OWNER' : 'MEMBER',
        },
      });
      await tx.auditLog.create({
        data: {
          action: 'cli.user.create',
          outcome: 'SUCCESS',
          userId: user.id,
          householdId: household.id,
        },
      });
      return {
        userId: user.id,
        householdId: household.id,
        role: existing === 0 ? 'OWNER' : 'MEMBER',
      };
    });
    process.stdout.write(
      `User created: ${result.userId} (${args.email})\nHousehold: ${result.householdId} (role ${result.role})\n` +
        'TOTP 2FA will be enrolled on the first login.\n',
    );
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      throw new Error('A user with this email already exists.');
    }
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`create-user: ${(err as Error).message}\n`);
  process.exit(1);
});
