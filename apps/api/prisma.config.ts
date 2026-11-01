// Prisma CLI configuration (migrate, generate). The connection URL is built
// from DB_* and DB_PASSWORD_FILE, exactly like the API does at runtime; it is
// never stored in the environment or in a file.
// `prisma generate` does not need a database, so the URL is only built for
// commands that connect.
import { defineConfig } from 'prisma/config';
import { buildDatabaseUrl } from './src/app/config/database-url';

const needsDatabase = !process.argv.includes('generate');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  ...(needsDatabase && { datasource: { url: buildDatabaseUrl() } }),
});
