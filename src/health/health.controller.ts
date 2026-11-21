import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '../database/prisma.service';
import { redisCacheStatus } from '../cache/redis-cache';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prismaHealth: PrismaHealthIndicator,
    private prisma: PrismaService,
  ) {}

  @Get('live')
  @ApiOperation({ summary: 'Liveness: o processo está no ar' })
  live() {
    // `cache.redis` é informativo (up/down/disabled) e nunca derruba o 200.
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      cache: { redis: redisCacheStatus() },
    };
  }

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma),
    ]);
  }
}
