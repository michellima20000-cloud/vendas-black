import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [
    // Memory storage: o service envia `file.buffer` para o storage configurado
    // (Vercel Blob em produção, MinIO no dev local).
    MulterModule.register({
      limits: { fileSize: 5 * 1024 * 1024, files: 20 },
    }),
  ],
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
