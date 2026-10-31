import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { configureApp } from './app/configure-app';

async function bootstrap(): Promise<void> {
  const app = configureApp(await NestFactory.create(AppModule));
  const port = Number(process.env['API_PORT'] ?? 3000);
  const host = process.env['API_HOST'] ?? '127.0.0.1';
  await app.listen(port, host);
  Logger.log(`API listening on http://${host}:${port} (health: /health)`);

  // Set by `nx serve` so it knows when the server is ready.
  if (process.env['NX_READY_SIGNAL_SOCKET']) {
    try {
      // Dynamic import kept out of the bundle on purpose (dev-only helper).
      const load = new Function('s', 'return import(s)') as (
        s: string,
      ) => Promise<{ emitReadySignal(server: unknown): boolean }>;
      (await load('@nx/js/ready-signal')).emitReadySignal(app.getHttpServer());
    } catch {
      // @nx/js not installed (e.g. production image): nothing to signal.
    }
  }
}

void bootstrap();
