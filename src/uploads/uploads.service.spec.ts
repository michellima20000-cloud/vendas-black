import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadsService } from './uploads.service';

function makeFile(
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  return {
    fieldname: 'files',
    originalname: 'foto.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: 1024,
    buffer: Buffer.from('fake-image'),
    stream: undefined as never,
    destination: '',
    path: '',
    ...overrides,
  } as Express.Multer.File;
}

describe('UploadsService', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('usa o driver Vercel Blob quando há BLOB_READ_WRITE_TOKEN', () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test';
    const service = new UploadsService(
      new ConfigService({ MINIO_ENDPOINT: 'minio.exemplo.com' }),
    );
    expect(service.storageDriver).toBe('vercel');
  });

  it('usa o driver MinIO quando não há token do Blob', () => {
    const service = new UploadsService(
      new ConfigService({ MINIO_ENDPOINT: 'minio.exemplo.com' }),
    );
    expect(service.storageDriver).toBe('minio');
  });

  it('fica sem driver quando não há nenhum storage configurado', () => {
    const service = new UploadsService(new ConfigService({}));
    expect(service.storageDriver).toBe('none');
  });

  it('responde 503 com mensagem clara quando não há storage', async () => {
    const service = new UploadsService(new ConfigService({}));
    await expect(service.uploadFile(makeFile())).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('rejeita formato de imagem não suportado', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test';
    const service = new UploadsService(new ConfigService({}));
    await expect(
      service.uploadFile(makeFile({ mimetype: 'application/pdf' })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejeita imagem acima de 5MB', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test';
    const service = new UploadsService(new ConfigService({}));
    await expect(
      service.uploadFile(makeFile({ size: 6 * 1024 * 1024 })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejeita arquivo vazio', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test';
    const service = new UploadsService(new ConfigService({}));
    await expect(
      service.uploadFile(makeFile({ size: 0, buffer: Buffer.alloc(0) })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
