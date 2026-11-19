import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { PaymentMethod } from '@prisma/client';
import { OrdersController } from '../src/orders/orders.controller';
import { OrdersService } from '../src/orders/orders.service';

describe('Orders (e2e)', () => {
  let app: INestApplication;
  const ordersService = {
    create: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: ordersService,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    ordersService.create.mockReset();
    ordersService.create.mockResolvedValue({ id: 'order-1' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts and forwards a valid order without requiring a database', async () => {
    const payload = {
      storeSlug: 'loja',
      items: [{ productId: 'product-1', quantity: 2 }],
      paymentMethod: PaymentMethod.PIX,
      address: {
        street: 'Rua A',
        number: '10',
        district: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01001000',
      },
    };

    await request(app.getHttpServer())
      .post('/api/v1/orders')
      .send(payload)
      .expect(201);

    expect(ordersService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        storeSlug: 'loja',
        paymentMethod: PaymentMethod.PIX,
        address: expect.objectContaining({ city: 'São Paulo' }),
      }),
    );
  });

  it('rejects an invalid payment method before reaching the service', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/orders')
      .send({
        storeSlug: 'loja',
        items: [{ productId: 'product-1', quantity: 1 }],
        paymentMethod: 'CASH',
      })
      .expect(400);

    expect(ordersService.create).not.toHaveBeenCalled();
  });
});
