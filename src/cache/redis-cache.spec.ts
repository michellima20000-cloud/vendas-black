import {
  cacheGet,
  cacheKey,
  cacheSet,
  initRedisCache,
  redisCacheStatus,
} from './redis-cache';

describe('redis-cache', () => {
  it('fica desativado sem REDIS_URL', () => {
    delete process.env.REDIS_URL;
    initRedisCache();
    expect(redisCacheStatus()).toBe('disabled');
  });

  it('cacheGet retorna null quando desativado', async () => {
    await expect(cacheGet('qualquer-chave')).resolves.toBeNull();
  });

  it('cacheSet é silencioso quando desativado', async () => {
    await expect(cacheSet('qualquer-chave', { a: 1 }, 60)).resolves.toBeUndefined();
  });

  it('monta chaves no padrão vendas:api:v1', () => {
    expect(cacheKey('store', 'minha-loja')).toBe(
      'vendas:api:v1:store:minha-loja',
    );
  });
});
