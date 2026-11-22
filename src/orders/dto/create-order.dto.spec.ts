import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaymentMethod } from '@prisma/client';
import { CreateOrderDto } from './create-order.dto';

describe('CreateOrderDto', () => {
  it('accepts a valid address and payment method', async () => {
    const dto = plainToInstance(CreateOrderDto, {
      storeSlug: 'loja',
      items: [{ productId: 'product-1', quantity: 2 }],
      paymentMethod: PaymentMethod.CREDIT_CARD,
      address: {
        street: 'Rua A',
        number: '10',
        complement: 'Sala 2',
        district: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01001-000',
      },
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('treats empty optional strings as absent instead of failing validation', async () => {
    const dto = plainToInstance(CreateOrderDto, {
      storeSlug: 'loja',
      items: [{ productId: 'product-1', quantity: 1, variation: '' }],
      couponCode: '',
      notes: '',
      address: {
        street: 'Rua A',
        number: '10',
        complement: '',
        district: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01001-000',
      },
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.items[0].variation).toBeUndefined();
    expect(dto.couponCode).toBeUndefined();
    expect(dto.notes).toBeUndefined();
    expect(dto.address.complement).toBeUndefined();
  });

  it('keeps non-empty optional strings intact', async () => {
    const dto = plainToInstance(CreateOrderDto, {
      storeSlug: 'loja',
      items: [{ productId: 'product-1', quantity: 1 }],
      couponCode: 'PROMO10',
      notes: 'Entregar após as 18h',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.couponCode).toBe('PROMO10');
    expect(dto.notes).toBe('Entregar após as 18h');
  });

  it('rejects an unsupported payment method', async () => {
    const dto = plainToInstance(CreateOrderDto, {
      storeSlug: 'loja',
      items: [{ productId: 'product-1', quantity: 1 }],
      paymentMethod: 'CASH',
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'paymentMethod')).toBe(
      true,
    );
  });

  it('rejects an incomplete nested address', async () => {
    const dto = plainToInstance(CreateOrderDto, {
      storeSlug: 'loja',
      items: [{ productId: 'product-1', quantity: 1 }],
      address: {
        street: 'Rua A',
        number: '10',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01001000',
      },
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'address')).toBe(true);
  });

  it('rejects an empty item list', async () => {
    const dto = plainToInstance(CreateOrderDto, {
      storeSlug: 'loja',
      items: [],
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'items')).toBe(true);
  });

  it('rejects a non-positive quantity', async () => {
    const dto = plainToInstance(CreateOrderDto, {
      storeSlug: 'loja',
      items: [{ productId: 'product-1', quantity: 0 }],
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'items')).toBe(true);
  });
});
