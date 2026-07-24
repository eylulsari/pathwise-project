import { Controller, Get } from '@nestjs/common';

/**
 * Liveness endpoint — GET /api/health
 * Used by Docker/humans to confirm the API is up.
 */
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'pathwise-backend',
      timestamp: new Date().toISOString(),
    };
  }
}
