import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateStoreDto } from './create-store.dto';

describe('CreateStoreDto', () => {
  it('accepts empty optional text fields', async () => {
    const dto = plainToInstance(CreateStoreDto, {
      slug: 'minha-loja',
      name: 'Minha Loja',
      description: '',
      about: '',
      whatsapp: '',
      instagram: '',
      couponCode: '',
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts omitted optional text fields', async () => {
    const dto = plainToInstance(CreateStoreDto, {
      slug: 'minha-loja',
      name: 'Minha Loja',
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('still rejects optional text fields above their maximum length', async () => {
    const dto = plainToInstance(CreateStoreDto, {
      slug: 'minha-loja',
      name: 'Minha Loja',
      description: 'x'.repeat(1001),
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'description')).toBe(true);
  });
});
