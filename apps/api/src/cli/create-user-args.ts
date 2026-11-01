import { parseArgs } from 'node:util';
import { EMAIL_RE, normaliseEmail } from '../app/auth/email';

export const USAGE = `Usage:
  create-user --email <email> --name <display name> (--household-name <name> | --household-id <uuid>)
The password is asked on stdin (hidden on a terminal, or the first line of a pipe).`;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CreateUserArgs {
  email: string;
  name: string;
  householdName?: string;
  householdId?: string;
}

export function parseCreateUserArgs(argv: string[]): CreateUserArgs {
  if (argv.some((a) => /^--?(p|password|pass|pwd)(=|$)/i.test(a))) {
    throw new Error(
      'Passwords are never accepted as arguments. Run without it and type it on stdin.',
    );
  }
  const { values } = parseArgs({
    args: argv,
    options: {
      email: { type: 'string' },
      name: { type: 'string' },
      'household-name': { type: 'string' },
      'household-id': { type: 'string' },
      help: { type: 'boolean' },
    },
    strict: true,
  });
  if (values.help) {
    throw new Error(USAGE);
  }
  const email = normaliseEmail(values.email ?? '');
  const name = (values.name ?? '').trim();
  const householdName = values['household-name']?.trim();
  const householdId = values['household-id']?.trim();
  if (!EMAIL_RE.test(email)) throw new Error(`Invalid --email.\n${USAGE}`);
  if (!name || name.length > 100) throw new Error(`Invalid --name.\n${USAGE}`);
  if (Boolean(householdName) === Boolean(householdId)) {
    throw new Error(
      `Give exactly one of --household-name or --household-id.\n${USAGE}`,
    );
  }
  if (householdId && !UUID_RE.test(householdId))
    throw new Error('Invalid --household-id.');
  if (householdName && householdName.length > 100)
    throw new Error('Invalid --household-name.');
  return { email, name, householdName, householdId };
}
