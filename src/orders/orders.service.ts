import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateOrderDto, OrderItemDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateOrderDto) {
    this.assertValidItems(dto.items);

    const productIds = [
      ...new Set(dto.items.map((item) => item.productId.trim())),
    ];

    return this.prisma.$transaction(async (tx) => {
      const store = await tx.store.findUnique({
        where: { slug: dto.storeSlug.trim() },
      });
      if (!store || !store.isActive) {
        throw new NotFoundException('Loja não encontrada');
      }

      const products = await tx.product.findMany({
        where: { id: { in: productIds }, storeId: store.id },
        include: { variations: true },
      });
      if (
        products.length !== productIds.length ||
        products.some((product) => product.storeId !== store.id)
      ) {
        throw new BadRequestException(
          'Um ou mais produtos não pertencem a esta loja',
        );
      }

      const productsById = new Map(products.map((product) => [product.id, product]));
      const lines = this.buildOrderLines(dto.items, productsById);
      const quantitiesByProduct = this.sumQuantitiesByProduct(lines);

      for (const product of products) {
        if (!product.isActive) {
          throw new BadRequestException(
            `Produto ${product.id} não está disponível`,
          );
        }

        const quantity = quantitiesByProduct.get(product.id) ?? 0;
        if (quantity > product.stock) {
          throw new BadRequestException(
            `Estoque insuficiente para o produto ${product.id}`,
          );
        }

        if (!Number.isFinite(product.price) || product.price < 0) {
          throw new BadRequestException(
            `O produto ${product.id} possui um preço inválido`,
          );
        }
      }

      const subtotal = this.roundCurrency(
        lines.reduce((sum, line) => sum + line.price * line.quantity, 0),
      );
      const { discount, couponCode } = this.calculateDiscount(
        subtotal,
        dto.couponCode,
        store.couponCode,
        store.couponValue,
      );
      const total = this.roundCurrency(Math.max(0, subtotal - discount));

      for (const [productId, quantity] of quantitiesByProduct) {
        const updated = await tx.product.updateMany({
          where: {
            id: productId,
            storeId: store.id,
            isActive: true,
            stock: { gte: quantity },
          },
          data: { stock: { decrement: quantity } },
        });
        if (updated.count !== 1) {
          throw new BadRequestException(
            `Estoque insuficiente para o produto ${productId}`,
          );
        }
      }

      return tx.order.create({
        data: {
          storeId: store.id,
          paymentMethod: dto.paymentMethod,
          total,
          discount,
          couponCode,
          notes: dto.notes,
          items: { create: lines },
          ...(dto.address
            ? {
                address: {
                  create: {
                    street: dto.address.street.trim(),
                    number: dto.address.number.trim(),
                    complement: dto.address.complement?.trim(),
                    district: dto.address.district.trim(),
                    city: dto.address.city.trim(),
                    state: dto.address.state.trim().toUpperCase(),
                    zipCode: dto.address.zipCode.trim(),
                  },
                },
              }
            : {}),
        },
        include: {
          items: { include: { product: true } },
          address: true,
        },
      });
    });
  }

  async findByStore(ownerId: string, page = 1, limit = 20) {
    const store = await this.resolveOwnedStore(ownerId);
    const safePage = Math.max(1, Math.floor(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit) || 20));
    const skip = (safePage - 1) * safeLimit;
    const where = { storeId: store.id };
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: safeLimit,
        include: {
          items: { include: { product: true } },
          address: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);
    return {
      data: orders,
      total,
      page: safePage,
      limit: safeLimit,
      pages: Math.ceil(total / safeLimit),
    };
  }

  async updateStatus(ownerId: string, id: string, status: OrderStatus) {
    if (!Object.values(OrderStatus).includes(status)) {
      throw new BadRequestException('Status de pedido inválido');
    }

    const store = await this.resolveOwnedStore(ownerId);
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: { id: true, storeId: true },
    });
    if (!order || order.storeId !== store.id) {
      throw new NotFoundException('Pedido não encontrado');
    }

    return this.prisma.order.update({
      where: { id },
      data: { status },
      include: {
        items: { include: { product: true } },
        address: true,
      },
    });
  }

  private assertValidItems(items: OrderItemDto[]): void {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('O pedido deve conter ao menos um item');
    }

    for (const item of items) {
      if (
        !item ||
        typeof item.productId !== 'string' ||
        !item.productId.trim() ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 1000
      ) {
        throw new BadRequestException('Item ou quantidade inválido');
      }
    }
  }

  private buildOrderLines(
    requestedItems: OrderItemDto[],
    productsById: Map<
      string,
      {
        id: string;
        price: number;
        variations: Array<{ type: string; value: string }>;
      }
    >,
  ) {
    const linesByKey = new Map<
      string,
      { productId: string; quantity: number; price: number; variation?: string }
    >();

    for (const requestedItem of requestedItems) {
      const productId = requestedItem.productId.trim();
      const product = productsById.get(productId);
      if (!product) {
        throw new BadRequestException(
          'Um ou mais produtos não pertencem a esta loja',
        );
      }

      const variation = requestedItem.variation?.trim();
      if (variation) {
        const validVariation = product.variations.some(
          (item) =>
            item.value === variation || `${item.type}:${item.value}` === variation,
        );
        if (!validVariation) {
          throw new BadRequestException(
            `Variação inválida para o produto ${productId}`,
          );
        }
      }

      const key = `${productId}\u0000${variation ?? ''}`;
      const existingLine = linesByKey.get(key);
      if (existingLine) {
        existingLine.quantity += requestedItem.quantity;
      } else {
        linesByKey.set(key, {
          productId,
          quantity: requestedItem.quantity,
          price: product.price,
          variation: variation || undefined,
        });
      }
    }

    return [...linesByKey.values()];
  }

  private sumQuantitiesByProduct(
    lines: Array<{ productId: string; quantity: number }>,
  ): Map<string, number> {
    const quantities = new Map<string, number>();
    for (const line of lines) {
      quantities.set(
        line.productId,
        (quantities.get(line.productId) ?? 0) + line.quantity,
      );
    }
    return quantities;
  }

  private calculateDiscount(
    subtotal: number,
    requestedCode: string | undefined,
    storeCode: string | null,
    storeValue: number | null,
  ): { discount: number; couponCode: string | null } {
    const code = requestedCode?.trim();
    if (!code) {
      return { discount: 0, couponCode: null };
    }

    if (
      !storeCode ||
      storeCode.trim().toUpperCase() !== code.toUpperCase() ||
      storeValue === null ||
      !Number.isFinite(storeValue) ||
      storeValue < 0
    ) {
      throw new BadRequestException('Cupom inválido');
    }

    // couponValue is a fixed monetary discount, matching Store.couponValue.
    const discount = this.roundCurrency(Math.min(subtotal, storeValue));
    return { discount, couponCode: storeCode.trim() };
  }

  private roundCurrency(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private async resolveOwnedStore(ownerId: string) {
    const store = await this.prisma.store.findUnique({ where: { ownerId } });
    if (!store) {
      throw new NotFoundException('Loja não encontrada para este usuário');
    }
    return store;
  }
}
