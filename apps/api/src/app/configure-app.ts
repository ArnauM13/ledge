import { INestApplication, RequestMethod } from '@nestjs/common';

/**
 * Shared HTTP setup for main.ts and tests.
 * Business routes will live under `/api`; `/health` stays at the root so
 * Docker and the future reverse proxy can probe it without the prefix.
 */
export function configureApp<T extends INestApplication>(app: T): T {
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
  app.enableShutdownHooks();
  return app;
}
