import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { put } from '@vercel/blob';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

const ALLOWED_MIME_TYPES = /^image\/(jpeg|png|webp|gif)$/;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Storage de imagens.
 *
 * Dois drivers, escolhidos pela configuração:
 * - `vercel` (produção): Vercel Blob, usando BLOB_READ_WRITE_TOKEN.
 *   Funciona de qualquer lugar, não depende de disco local.
 * - `minio` (dev local): MinIO/S3 compatível, via docker-compose.
 *
 * Sem nenhum dos dois configurados, o upload responde 503 com mensagem
 * clara em vez de estourar um 500 "Internal server error".
 */
@Injectable()
export class UploadsService implements OnModuleInit {
  private readonly logger = new Logger(UploadsService.name);

  private driver: 'vercel' | 'minio' | 'none' = 'none';
  private minioClient: Minio.Client | null = null;
  private bucket = 'vendas-uploads';
  private publicUrl = '';

  constructor(private config: ConfigService) {
    const blobToken = this.config.get('BLOB_READ_WRITE_TOKEN')?.trim();
    const minioEndpoint = this.config.get('MINIO_ENDPOINT')?.trim();

    if (blobToken) {
      this.driver = 'vercel';
      this.logger.log('Upload: usando Vercel Blob');
    } else if (minioEndpoint && minioEndpoint !== 'localhost') {
      this.driver = 'minio';
      this.bucket = this.config.get('MINIO_BUCKET', 'vendas-uploads');
      this.publicUrl = (
        this.config.get<string>('MINIO_PUBLIC_URL') ??
        `http://${minioEndpoint}:${this.config.get('MINIO_PORT', '9000')}`
      ).replace(/\/$/, '');
      this.minioClient = new Minio.Client({
        endPoint: minioEndpoint,
        port: parseInt(this.config.get('MINIO_PORT', '9000'), 10),
        useSSL: this.config.get('MINIO_USE_SSL') === 'true',
        accessKey: this.config.get('MINIO_ACCESS_KEY', 'minioadmin'),
        secretKey: this.config.get('MINIO_SECRET_KEY', 'minioadmin'),
      });
      this.logger.log('Upload: usando MinIO');
    } else {
      this.logger.warn(
        'Upload: nenhum storage configurado (defina BLOB_READ_WRITE_TOKEN ou MINIO_ENDPOINT)',
      );
    }
  }

  async onModuleInit() {
    if (this.driver !== 'minio' || !this.minioClient) return;

    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.ensureBucket(),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('MinIO connection timed out')),
            5_000,
          );
        }),
      ]);
    } catch (error) {
      // MinIO may be unavailable during boot; uploads will surface the error.
      this.logger.warn(
        `Não foi possível preparar o bucket "${this.bucket}": ${
          error instanceof Error ? error.message : error
        }`,
      );
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async ensureBucket() {
    if (!this.minioClient) return;
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
  }

  /**
   * Driver de storage em uso. Exposto no health check para diagnóstico.
   */
  get storageDriver(): 'vercel' | 'minio' | 'none' {
    return this.driver;
  }

  async uploadFile(
    file: Express.Multer.File,
    folder = 'uploads',
  ): Promise<string> {
    if (!file || !file.buffer || !file.size) {
      throw new BadRequestException('Arquivo inválido');
    }
    if (!ALLOWED_MIME_TYPES.test(file.mimetype)) {
      throw new BadRequestException(
        'Formato inválido. Envie JPEG, PNG, WEBP ou GIF',
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('Cada imagem deve ter no máximo 5MB');
    }

    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const pathname = `${folder}/${uuidv4()}${ext}`;

    if (this.driver === 'vercel') {
      return this.uploadToVercelBlob(pathname, file);
    }
    if (this.driver === 'minio' && this.minioClient) {
      return this.uploadToMinio(pathname, file);
    }

    throw new ServiceUnavailableException(
      'O envio de imagens não está disponível no momento. Tente novamente mais tarde.',
    );
  }

  private async uploadToVercelBlob(
    pathname: string,
    file: Express.Multer.File,
  ): Promise<string> {
    try {
      const result = await put(pathname, file.buffer, {
        access: 'public',
        contentType: file.mimetype,
        token: this.config.get('BLOB_READ_WRITE_TOKEN'),
        addRandomSuffix: false,
      });
      return result.url;
    } catch (error) {
      this.logger.error(
        `Falha no upload para o Vercel Blob: ${
          error instanceof Error ? error.message : error
        }`,
      );
      throw new ServiceUnavailableException(
        'Não foi possível enviar a imagem. Tente novamente em instantes.',
      );
    }
  }

  private async uploadToMinio(
    pathname: string,
    file: Express.Multer.File,
  ): Promise<string> {
    try {
      await this.minioClient!.putObject(
        this.bucket,
        pathname,
        file.buffer,
        file.size,
        { 'Content-Type': file.mimetype },
      );
      return `${this.publicUrl}/${this.bucket}/${pathname}`;
    } catch (error) {
      this.logger.error(
        `Falha no upload para o MinIO: ${
          error instanceof Error ? error.message : error
        }`,
      );
      throw new ServiceUnavailableException(
        'Não foi possível enviar a imagem. Tente novamente em instantes.',
      );
    }
  }
}
