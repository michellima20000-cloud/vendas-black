import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { UpdateStoreThemeDto } from './dto/update-store-theme.dto';

@Injectable()
export class StoresService {
  constructor(private prisma: PrismaService) {}

  async findBySlug(slug: string) {
    const store = await this.prisma.store.findUnique({
      where: { slug },
      include: {
        theme: true,
        howToBuy: { orderBy: { step: 'asc' } },
        categories: true,
      },
    });
    if (!store || !store.isActive) {
      throw new NotFoundException('Loja não encontrada');
    }
    return store;
  }

  async findByOwner(ownerId: string) {
    const store = await this.prisma.store.findUnique({
      where: { ownerId },
      include: { theme: true, howToBuy: { orderBy: { step: 'asc' } } },
    });
    if (!store) throw new NotFoundException('Loja não encontrada');
    return store;
  }

  async create(ownerId: string, dto: CreateStoreDto) {
    const slugExists = await this.prisma.store.findUnique({
      where: { slug: dto.slug },
    });
    if (slugExists) throw new ConflictException('Slug já utilizado');

    const ownerHasStore = await this.prisma.store.findUnique({
      where: { ownerId },
    });
    if (ownerHasStore) {
      throw new ConflictException('Usuário já possui uma loja');
    }

    return this.prisma.$transaction(async (tx) => {
      const store = await tx.store.create({
        data: {
          slug: dto.slug,
          name: dto.name,
          description: dto.description,
          about: dto.about,
          whatsapp: dto.whatsapp,
          instagram: dto.instagram,
          couponCode: dto.couponCode,
          couponValue: dto.couponValue,
          ownerId,
          theme: { create: {} },
          howToBuy: {
            create: [
              {
                step: 1,
                icon: 'ShoppingBag',
                title: 'Escolha os produtos',
                subtitle: 'Navegue pelo catálogo',
              },
              {
                step: 2,
                icon: 'MessageCircle',
                title: 'Fale pelo WhatsApp',
                subtitle: 'Envie seu pedido',
              },
              {
                step: 3,
                icon: 'CreditCard',
                title: 'Faça o pagamento',
                subtitle: 'PIX ou cartão',
              },
              {
                step: 4,
                icon: 'Package',
                title: 'Receba em casa',
                subtitle: 'Entregamos para você',
              },
            ],
          },
        },
        include: { theme: true, howToBuy: true },
      });

      await tx.user.update({
        where: { id: ownerId },
        data: { role: Role.STORE_OWNER },
      });

      return store;
    });
  }

  async update(ownerId: string, dto: UpdateStoreDto) {
    const store = await this.prisma.store.findUnique({ where: { ownerId } });
    if (!store) throw new NotFoundException('Loja não encontrada');

    const data = {
      ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description }
        : {}),
      ...(dto.about !== undefined ? { about: dto.about } : {}),
      ...(dto.whatsapp !== undefined ? { whatsapp: dto.whatsapp } : {}),
      ...(dto.instagram !== undefined ? { instagram: dto.instagram } : {}),
      ...(dto.couponCode !== undefined
        ? { couponCode: dto.couponCode }
        : {}),
      ...(dto.couponValue !== undefined
        ? { couponValue: dto.couponValue }
        : {}),
    };

    return this.prisma.store.update({
      where: { ownerId },
      data,
      include: { theme: true },
    });
  }

  async findAll(page = 1, limit = 20) {
    const safePage = Math.max(1, Math.floor(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit) || 20));
    const skip = (safePage - 1) * safeLimit;
    const [stores, total] = await Promise.all([
      this.prisma.store.findMany({
        skip,
        take: safeLimit,
        include: { owner: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.store.count(),
    ]);
    return {
      data: stores,
      total,
      page: safePage,
      limit: safeLimit,
      pages: Math.ceil(total / safeLimit),
    };
  }

  async updateTheme(ownerId: string, dto: UpdateStoreThemeDto) {
    const data = {
      ...(dto.primaryColor !== undefined
        ? { primaryColor: dto.primaryColor }
        : {}),
      ...(dto.accentColor !== undefined
        ? { accentColor: dto.accentColor }
        : {}),
      ...(dto.bgColor !== undefined ? { bgColor: dto.bgColor } : {}),
      ...(dto.fontTitle !== undefined ? { fontTitle: dto.fontTitle } : {}),
      ...(dto.fontBody !== undefined ? { fontBody: dto.fontBody } : {}),
    };
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Nenhum campo de tema foi informado');
    }

    const store = await this.prisma.store.findUnique({ where: { ownerId } });
    if (!store) throw new NotFoundException('Loja não encontrada');

    return this.prisma.storeTheme.upsert({
      where: { storeId: store.id },
      update: data,
      create: { storeId: store.id, ...data },
    });
  }
}
