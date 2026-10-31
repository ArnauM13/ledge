import { Test } from '@nestjs/testing';
import { isHealthResponse } from '@ledge/shared-types';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();
    controller = moduleRef.get(HealthController);
  });

  it('returns an ok status with a valid timestamp', () => {
    const body = controller.check();
    expect(isHealthResponse(body)).toBe(true);
    expect(body.status).toBe('ok');
  });
});
