import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

@Injectable()
export class UploadsService implements OnModuleInit {
  private readonly logger = new Logger(UploadsService.name);
  private minioClient: Minio.Client;
  private bucket: string;
  private publicUrl: string;

  constructor(private config: ConfigService) {
    this.bucket = config.get('MINIO_BUCKET', 'vendas-uploads');
    const endpoint = config.get('MINIO_ENDPOINT', 'localhost');
    const port = config.get('MINIO_PORT', '9000');

    this.minioClient = new Minio.Client({
      endPoint: endpoint,
      port: parseInt(port),
      useSSL: config.get('MINIO_USE_SSL') === 'true',
      accessKey: config.get('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: config.get('MINIO_SECRET_KEY', 'minioadmin'),
    });

    this.publicUrl = (
      config.get<string>('MINIO_PUBLIC_URL') ?? `http://${endpoint}:${port}`
    ).replace(/\/$/, '');
  }

  async onModuleInit() {
    try {
      const exists = await this.minioClient.bucketExists(this.bucket);
      if (exists) return;

      await this.minioClient.makeBucket(this.bucket);
      await this.minioClient.setBucketPolicy(
        this.bucket,
        JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${this.bucket}/*`],
            },
          ],
        }),
      );
      this.logger.log(`Bucket "${this.bucket}" criado`);
    } catch (error) {
      // MinIO may be unavailable during boot; uploads will surface the error.
      this.logger.warn(
        `Não foi possível preparar o bucket "${this.bucket}": ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    folder = 'uploads',
  ): Promise<string> {
    if (!file || !file.buffer || !file.size) {
      throw new BadRequestException('Arquivo inválido');
    }
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) {
      throw new BadRequestException(
        'Formato inválido. Envie JPEG, PNG, WEBP ou GIF',
      );
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Cada imagem deve ter no máximo 5MB');
    }

    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${folder}/${uuidv4()}${ext}`;
    await this.minioClient.putObject(
      this.bucket,
      filename,
      file.buffer,
      file.size,
      { 'Content-Type': file.mimetype },
    );

    return `${this.publicUrl}/${this.bucket}/${filename}`;
  }
}
