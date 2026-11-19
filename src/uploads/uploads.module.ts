import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [
    // Memory storage: the service streams `file.buffer` to MinIO.
    MulterModule.register({
      limits: { fileSize: 5 * 1024 * 1024, files: 20 },
    }),
  ],
  controllers: [UploadsController],
  providers: [UploadsService],
})
export class UploadsModule {}
