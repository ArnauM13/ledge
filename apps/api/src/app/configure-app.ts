import { INestApplication, RequestMethod } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';

/**
 * Shared HTTP setup for main.ts and tests.
 * Business routes live under `/api`; `/health` stays at the root so Docker
 * and the future reverse proxy can probe it without the prefix.
 */
export function configureApp<T extends INestApplication>(app: T): T {
  const express = app as unknown as NestExpressApplication;
  express.disable('x-powered-by');
  // Behind a reverse proxy, set API_TRUST_PROXY (e.g. `1` = one hop) so req.ip
  // is the client and not the proxy. Off by default: X-Forwarded-For is ignored.
  const trustProxy = process.env['API_TRUST_PROXY'];
  if (trustProxy) {
    express.set(
      'trust proxy',
      /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy,
    );
  }
  express.useBodyParser('json', { limit: '16kb' });
  express.use(cookieParser());
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
  app.enableShutdownHooks();
  return app;
}
