import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { isHealthResponse } from '@ledge/shared-types';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

describe('API (HTTP)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = configureApp(moduleRef.createNestApplication({ logger: false }));
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns 200 with the health payload', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    expect(isHealthResponse(await res.json())).toBe(true);
  });

  it('unknown routes under /api return 404', async () => {
    const res = await fetch(`${baseUrl}/api/does-not-exist`);
    expect(res.status).toBe(404);
  });
});
