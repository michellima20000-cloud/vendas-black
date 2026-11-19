import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  let prisma: any;
  let service: ProductsService;

  beforeEach(() => {
    prisma = {
      store: {
        findUnique: jest.fn(),
      },
      product: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      category: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    };
    service = new ProductsService(prisma);
  });

  it('resolves the owner store and does not use the user id as storeId on create', async () => {
    prisma.store.findUnique.mockResolvedValue({
      id: 'store-1',
      ownerId: 'owner-1',
    });
    prisma.product.create.mockResolvedValue({ id: 'product-1' });

    await service.create('owner-1', {
      name: 'Produto',
      price: 19.9,
      images: [],
    });

    expect(prisma.store.findUnique).toHaveBeenCalledWith({
      where: { ownerId: 'owner-1' },
    });
    expect(prisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ storeId: 'store-1' }),
      }),
    );
    expect(prisma.product.create.mock.calls[0][0].data.storeId).not.toBe(
      'owner-1',
    );
  });

  it('rejects a category that belongs to another store', async () => {
    prisma.store.findUnique.mockResolvedValue({
      id: 'store-1',
      ownerId: 'owner-1',
    });
    prisma.category.findUnique.mockResolvedValue({
      id: 'category-2',
      storeId: 'store-2',
    });

    await expect(
      service.create('owner-1', {
        name: 'Produto',
        price: 10,
        categoryId: 'category-2',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it('does not update a product owned by another store', async () => {
    prisma.store.findUnique.mockResolvedValue({
      id: 'store-1',
      ownerId: 'owner-1',
    });
    prisma.product.findUnique.mockResolvedValue({
      id: 'product-2',
      storeId: 'store-2',
    });

    await expect(
      service.update('owner-1', 'product-2', { name: 'Alterado' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('does not soft-delete a product owned by another store', async () => {
    prisma.store.findUnique.mockResolvedValue({
      id: 'store-1',
      ownerId: 'owner-1',
    });
    prisma.product.findUnique.mockResolvedValue({
      id: 'product-2',
      storeId: 'store-2',
    });

    await expect(service.remove('owner-1', 'product-2')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('lists only categories from the store resolved by ownerId', async () => {
    prisma.store.findUnique.mockResolvedValue({
      id: 'store-1',
      ownerId: 'owner-1',
    });
    prisma.category.findMany.mockResolvedValue([]);

    await service.findMyCategories('owner-1');

    expect(prisma.store.findUnique).toHaveBeenCalledWith({
      where: { ownerId: 'owner-1' },
    });
    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: { storeId: 'store-1' },
    });
  });

  it('lists only products from the store resolved by ownerId', async () => {
    prisma.store.findUnique.mockResolvedValue({
      id: 'store-1',
      ownerId: 'owner-1',
    });
    prisma.product.findMany.mockResolvedValue([]);
    prisma.product.count.mockResolvedValue(0);

    const result = await service.findByStore('owner-1', 2, 10);

    expect(prisma.store.findUnique).toHaveBeenCalledWith({
      where: { ownerId: 'owner-1' },
    });
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storeId: 'store-1' },
        skip: 10,
        take: 10,
      }),
    );
    expect(result).toEqual({
      data: [],
      total: 0,
      page: 2,
      limit: 10,
      pages: 0,
    });
  });
});
