import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const CONNECT_TIMEOUT_MS = 10_000;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    let timer: NodeJS.Timeout | undefined;

    try {
      await Promise.race([
        this.$connect(),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Database connection timed out')),
            CONNECT_TIMEOUT_MS,
          );
        }),
      ]);
      this.logger.log('Banco de dados conectado');
    } catch (error) {
      // Do not block the HTTP server from starting. The readiness check
      // (/api/v1/health) will report the database failure while liveness
      // (/api/v1/health/live) keeps the instance alive.
      this.logger.error(
        `Banco indisponível no boot: ${
          error instanceof Error ? error.message : error
        }`,
      );
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
