import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@ledge/shared-types';
import { Public } from '../auth/auth.guard';

@Public()
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
