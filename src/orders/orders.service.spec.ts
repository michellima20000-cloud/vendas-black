import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, PaymentMethod } from '@prisma/client';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  let prisma: any;
  let tx: any;
  let service: OrdersService;

  beforeEach(() => {
    tx = {
      store: {
        findUnique: jest.fn(),
      },
      product: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      order: {
        create: jest.fn(),
      },
    };

    prisma = {
      $transaction: jest.fn(async (callback: (client: any) => unknown) =>
        callback(tx),
      ),
      store: {
        findUnique: jest.fn(),
      },
      order: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new OrdersService(prisma);
  });

  it('creates an order only with active products from the selected store', async () => {
    tx.store.findUnique.mockResolvedValue({
      id: 'store-1',
      slug: 'loja',
      isActive: true,
      couponCode: null,
      couponValue: null,
    });
    tx.product.findMany.mockResolvedValue([
      {
        id: 'product-1',
        storeId: 'store-1',
        price: 25,
        stock: 10,
        isActive: true,
        variations: [],
      },
    ]);
    tx.product.updateMany.mockResolvedValue({ count: 1 });
    tx.order.create.mockResolvedValue({ id: 'order-1' });

    await service.create({
      storeSlug: 'loja',
      items: [{ productId: 'product-1', quantity: 2 }],
      paymentMethod: PaymentMethod.PIX,
      address: {
        street: 'Rua A',
        number: '10',
        district: 'Centro',
        city: 'São Paulo',
        state: 'sp',
        zipCode: '01001000',
      },
    });

    expect(tx.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['product-1'] }, storeId: 'store-1' },
      }),
    );
    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'product-1',
        storeId: 'store-1',
        isActive: true,
        stock: { gte: 2 },
      },
      data: { stock: { decrement: 2 } },
    });
    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          storeId: 'store-1',
          total: 50,
          discount: 0,
          paymentMethod: PaymentMethod.PIX,
          address: {
            create: expect.objectContaining({
              street: 'Rua A',
              state: 'SP',
            }),
          },
        }),
      }),
    );
  });

  it('rejects a product that belongs to another store', async () => {
    tx.store.findUnique.mockResolvedValue({
      id: 'store-1',
      slug: 'loja',
      isActive: true,
      couponCode: null,
      couponValue: null,
    });
    tx.product.findMany.mockResolvedValue([
      {
        id: 'product-2',
        storeId: 'store-2',
        price: 25,
        stock: 10,
        isActive: true,
        variations: [],
      },
    ]);

    await expect(
      service.create({
        storeSlug: 'loja',
        items: [{ productId: 'product-2', quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('rejects an inactive product', async () => {
    tx.store.findUnique.mockResolvedValue({
      id: 'store-1',
      slug: 'loja',
      isActive: true,
      couponCode: null,
      couponValue: null,
    });
    tx.product.findMany.mockResolvedValue([
      {
        id: 'product-1',
        storeId: 'store-1',
        price: 25,
        stock: 10,
        isActive: false,
        variations: [],
      },
    ]);

    await expect(
      service.create({
        storeSlug: 'loja',
        items: [{ productId: 'product-1', quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.product.updateMany).not.toHaveBeenCalled();
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('rejects an order when the requested quantity exceeds stock', async () => {
    tx.store.findUnique.mockResolvedValue({
      id: 'store-1',
      slug: 'loja',
      isActive: true,
      couponCode: null,
      couponValue: null,
    });
    tx.product.findMany.mockResolvedValue([
      {
        id: 'product-1',
        storeId: 'store-1',
        price: 25,
        stock: 1,
        isActive: true,
        variations: [],
      },
    ]);

    await expect(
      service.create({
        storeSlug: 'loja',
        items: [{ productId: 'product-1', quantity: 2 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.product.updateMany).not.toHaveBeenCalled();
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('adds duplicate product quantities before checking stock', async () => {
    tx.store.findUnique.mockResolvedValue({
      id: 'store-1',
      slug: 'loja',
      isActive: true,
      couponCode: null,
      couponValue: null,
    });
    tx.product.findMany.mockResolvedValue([
      {
        id: 'product-1',
        storeId: 'store-1',
        price: 25,
        stock: 3,
        isActive: true,
        variations: [],
      },
    ]);

    await expect(
      service.create({
        storeSlug: 'loja',
        items: [
          { productId: 'product-1', quantity: 2 },
          { productId: 'product-1', quantity: 2 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.product.updateMany).not.toHaveBeenCalled();
  });

  it('calculates a fixed coupon discount and stores the coherent total', async () => {
    tx.store.findUnique.mockResolvedValue({
      id: 'store-1',
      slug: 'loja',
      isActive: true,
      couponCode: 'BLACK15',
      couponValue: 15,
    });
    tx.product.findMany.mockResolvedValue([
      {
        id: 'product-1',
        storeId: 'store-1',
        price: 100,
        stock: 10,
        isActive: true,
        variations: [],
      },
    ]);
    tx.product.updateMany.mockResolvedValue({ count: 1 });
    tx.order.create.mockResolvedValue({ id: 'order-1' });

    await service.create({
      storeSlug: 'loja',
      items: [{ productId: 'product-1', quantity: 1 }],
      couponCode: 'black15',
    });

    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          total: 85,
          discount: 15,
          couponCode: 'BLACK15',
        }),
      }),
    );
  });

  it('rejects an invalid coupon instead of silently ignoring it', async () => {
    tx.store.findUnique.mockResolvedValue({
      id: 'store-1',
      slug: 'loja',
      isActive: true,
      couponCode: 'BLACK15',
      couponValue: 15,
    });
    tx.product.findMany.mockResolvedValue([
      {
        id: 'product-1',
        storeId: 'store-1',
        price: 100,
        stock: 10,
        isActive: true,
        variations: [],
      },
    ]);

    await expect(
      service.create({
        storeSlug: 'loja',
        items: [{ productId: 'product-1', quantity: 1 }],
        couponCode: 'INVALID',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('resolves the store by ownerId when listing orders', async () => {
    prisma.store.findUnique.mockResolvedValue({
      id: 'store-1',
      ownerId: 'owner-1',
    });
    prisma.order.findMany.mockResolvedValue([]);
    prisma.order.count.mockResolvedValue(0);

    const result = await service.findByStore('owner-1', 1, 20);

    expect(prisma.store.findUnique).toHaveBeenCalledWith({
      where: { ownerId: 'owner-1' },
    });
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { storeId: 'store-1' } }),
    );
    expect(result.total).toBe(0);
  });

  it('does not update the status of an order from another store', async () => {
    prisma.store.findUnique.mockResolvedValue({
      id: 'store-1',
      ownerId: 'owner-1',
    });
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-2',
      storeId: 'store-2',
    });

    await expect(
      service.updateStatus('owner-1', 'order-2', OrderStatus.CONFIRMED),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('rejects an invalid order status', async () => {
    await expect(
      service.updateStatus('owner-1', 'order-1', 'INVALID' as OrderStatus),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.order.update).not.toHaveBeenCalled();
  });
});
