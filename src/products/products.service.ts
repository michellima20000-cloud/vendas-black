import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAllPublic(
    storeSlug: string,
    opts: { page?: number; limit?: number; category?: string; search?: string },
  ) {
    const { page = 1, limit = 12, category, search } = opts;
    const store = await this.prisma.store.findUnique({ where: { slug: storeSlug } });
    if (!store || !store.isActive) {
      throw new NotFoundException('Loja não encontrada');
    }

    const where: any = { storeId: store.id, isActive: true };
    if (category) where.category = { slug: category };
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const skip = (page - 1) * limit;
    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        include: { category: true, variations: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);
    return { data: products, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true, variations: true },
    });
    if (!product) throw new NotFoundException('Produto não encontrado');
    return product;
  }

  async create(ownerId: string, dto: CreateProductDto) {
    const store = await this.resolveOwnedStore(ownerId);

    if (dto.categoryId) {
      await this.assertCategoryBelongsToStore(dto.categoryId, store.id);
    }

    return this.prisma.product.create({
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        comparePrice: dto.comparePrice,
        images: dto.images ?? [],
        stock: dto.stock,
        installments: dto.installments,
        categoryId: dto.categoryId,
        isActive: dto.isActive,
        storeId: store.id,
      },
      include: { category: true, variations: true },
    });
  }

  async update(ownerId: string, id: string, dto: UpdateProductDto) {
    const store = await this.resolveOwnedStore(ownerId);
    await this.assertProductBelongsToStore(id, store.id);

    if (dto.categoryId) {
      await this.assertCategoryBelongsToStore(dto.categoryId, store.id);
    }

    const data = {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description }
        : {}),
      ...(dto.price !== undefined ? { price: dto.price } : {}),
      ...(dto.comparePrice !== undefined
        ? { comparePrice: dto.comparePrice }
        : {}),
      ...(dto.images !== undefined ? { images: dto.images } : {}),
      ...(dto.stock !== undefined ? { stock: dto.stock } : {}),
      ...(dto.installments !== undefined
        ? { installments: dto.installments }
        : {}),
      ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    };

    return this.prisma.product.update({
      where: { id },
      data,
      include: { category: true, variations: true },
    });
  }

  async remove(ownerId: string, id: string) {
    const store = await this.resolveOwnedStore(ownerId);
    await this.assertProductBelongsToStore(id, store.id);

    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async findByStore(ownerId: string, page = 1, limit = 20) {
    const store = await this.resolveOwnedStore(ownerId);
    const safePage = Math.max(1, Math.floor(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit) || 20));
    const skip = (safePage - 1) * safeLimit;
    const where = { storeId: store.id };
    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: safeLimit,
        include: { category: true, variations: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);
    return {
      data: products,
      total,
      page: safePage,
      limit: safeLimit,
      pages: Math.ceil(total / safeLimit),
    };
  }

  async findCategories(storeSlug: string) {
    const store = await this.prisma.store.findUnique({ where: { slug: storeSlug } });
    if (!store || !store.isActive) {
      throw new NotFoundException('Loja não encontrada');
    }
    return this.prisma.category.findMany({ where: { storeId: store.id } });
  }

  async findMyCategories(ownerId: string) {
    const store = await this.resolveOwnedStore(ownerId);
    return this.prisma.category.findMany({ where: { storeId: store.id } });
  }

  private async resolveOwnedStore(ownerId: string) {
    const store = await this.prisma.store.findUnique({ where: { ownerId } });
    if (!store) {
      throw new NotFoundException('Loja não encontrada para este usuário');
    }
    return store;
  }

  private async assertProductBelongsToStore(
    productId: string,
    storeId: string,
  ): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, storeId: true },
    });
    if (!product || product.storeId !== storeId) {
      throw new NotFoundException('Produto não encontrado');
    }
  }

  private async assertCategoryBelongsToStore(
    categoryId: string,
    storeId: string,
  ): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, storeId: true },
    });
    if (!category || category.storeId !== storeId) {
      throw new BadRequestException('Categoria inválida para esta loja');
    }
  }
}
