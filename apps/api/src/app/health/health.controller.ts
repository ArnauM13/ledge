import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@ledge/shared-types';

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      service: 'api',
      timestamp: new Date().toISOString(),
    };
  }
}
