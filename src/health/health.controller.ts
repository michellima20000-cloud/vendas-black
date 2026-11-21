import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '../database/prisma.service';
import { redisCacheStatus } from '../cache/redis-cache';
import { UploadsService } from '../uploads/uploads.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prismaHealth: PrismaHealthIndicator,
    private prisma: PrismaService,
    private uploads: UploadsService,
  ) {}

  @Get('live')
  @ApiOperation({ summary: 'Liveness: o processo está no ar' })
  live() {
    // `cache.redis` e `storage` são informativos (up/down/disabled) e nunca
    // derrubam o 200.
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      cache: { redis: redisCacheStatus() },
      storage: { uploads: this.uploads.storageDriver },
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
