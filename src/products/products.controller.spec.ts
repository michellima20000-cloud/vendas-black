import { ProductsController } from './products.controller';

describe('ProductsController', () => {
  it('passes the authenticated owner id to the service for GET /products/mine', async () => {
    const service = {
      findByStore: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      findMyCategories: jest.fn().mockResolvedValue([]),
    };
    const controller = new ProductsController(service as any);

    await controller.findMine({ user: { id: 'owner-1' } }, 2, 10);

    expect(service.findByStore).toHaveBeenCalledWith('owner-1', 2, 10);
  });

  it('passes the authenticated owner id for GET /products/mine/categories', async () => {
    const service = {
      findMyCategories: jest.fn().mockResolvedValue([]),
    };
    const controller = new ProductsController(service as any);

    await controller.getMyCategories({ user: { id: 'owner-1' } });

    expect(service.findMyCategories).toHaveBeenCalledWith('owner-1');
  });

  it('passes the authenticated owner id for product mutations', async () => {
    const service = {
      create: jest.fn().mockResolvedValue({ id: 'product-1' }),
      update: jest.fn().mockResolvedValue({ id: 'product-1' }),
      remove: jest.fn().mockResolvedValue({ id: 'product-1' }),
    };
    const controller = new ProductsController(service as any);
    const request = { user: { id: 'owner-1' } };

    await controller.create(request, { name: 'Produto', price: 10 });
    await controller.update(request, 'product-1', { name: 'Alterado' });
    await controller.remove(request, 'product-1');

    expect(service.create).toHaveBeenCalledWith('owner-1', {
      name: 'Produto',
      price: 10,
    });
    expect(service.update).toHaveBeenCalledWith('owner-1', 'product-1', {
      name: 'Alterado',
    });
    expect(service.remove).toHaveBeenCalledWith('owner-1', 'product-1');
  });

  it('passes the authenticated owner id for category mutations', async () => {
    const service = {
      createCategory: jest.fn().mockResolvedValue({ id: 'category-1' }),
      updateCategory: jest.fn().mockResolvedValue({ id: 'category-1' }),
      removeCategory: jest.fn().mockResolvedValue({ id: 'category-1' }),
    };
    const controller = new ProductsController(service as any);
    const request = { user: { id: 'owner-1' } };

    await controller.createCategory(request, { name: 'Colares' });
    await controller.updateCategory(request, 'category-1', {
      name: 'Brincos',
    });
    await controller.removeCategory(request, 'category-1');

    expect(service.createCategory).toHaveBeenCalledWith('owner-1', {
      name: 'Colares',
    });
    expect(service.updateCategory).toHaveBeenCalledWith(
      'owner-1',
      'category-1',
      { name: 'Brincos' },
    );
    expect(service.removeCategory).toHaveBeenCalledWith(
      'owner-1',
      'category-1',
    );
  });
});
