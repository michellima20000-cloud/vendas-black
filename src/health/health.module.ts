import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [TerminusModule, UploadsModule],
  controllers: [HealthController],
})
export class HealthModule {}
