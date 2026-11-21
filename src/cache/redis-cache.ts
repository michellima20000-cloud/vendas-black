import { Redis } from 'ioredis';

/**
 * Cache Redis opcional da API (camada de leitura das consultas públicas).
 *
 * Combinado com o Postgres (fonte dos dados), deixa as respostas públicas
 * rápidas sem pesquisar o banco a cada requisição.
 *
 * Regras importantes deste módulo:
 * - Só ativa se a env REDIS_URL estiver definida (Redis interno do Render).
 * - Qualquer falha (sem env, fora do ar, lento) faz a leitura cair direto no
 *   Postgres: a API nunca depende do Redis para responder.
 * - TTL curto (60s/300s), igual ao cache do site — sem invalidação complexa.
 * - Nunca guarda erro: loja/produto inexistente não entra no cache.
 */

const KEY_PREFIX = 'vendas:api:v1';

export const CACHE_TTL = {
  store: 60,
  products: 60,
  categories: 300,
} as const;

/** Tempo máximo esperando o Redis antes de desistir e ir no Postgres. */
const OP_TIMEOUT_MS = 1500;

/** Depois de uma falha, ignora o Redis por 30s (evita pagar timeout sempre). */
const COOLDOWN_MS = 30_000;

export type RedisCacheState = 'disabled' | 'connecting' | 'up' | 'down';

let client: Redis | null = null;
let state: RedisCacheState = 'disabled';
let skipUntil = 0;
let lastWarningAt = 0;

function warnOnce(reason: string) {
  const now = Date.now();
  if (now - lastWarningAt < COOLDOWN_MS) return;
  lastWarningAt = now;
  console.warn(
    `[cache] Redis indisponível por ${COOLDOWN_MS / 1000}s, seguindo sem cache: ${reason}`,
  );
}

function trip(reason: string) {
  skipUntil = Date.now() + COOLDOWN_MS;
  warnOnce(reason);
}

function usable(): boolean {
  return client !== null && state === 'up' && Date.now() >= skipUntil;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timeout após ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Conecta ao Redis definido em REDIS_URL. Sem env, fica desativado. */
export function initRedisCache(): void {
  const url = process.env.REDIS_URL?.trim();
  if (!url || client) return;

  client = new Redis(url, {
    lazyConnect: true,
    connectTimeout: OP_TIMEOUT_MS,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: (times) => Math.min(times * 1000, 10_000),
  });
  state = 'connecting';

  client.on('ready', () => {
    state = 'up';
    skipUntil = 0;
    console.log('[cache] Redis conectado');
  });
  client.on('error', (error: Error) => {
    if (state !== 'down') state = 'down';
    trip(error.message);
  });
  client.on('close', () => {
    if (state === 'up') state = 'down';
  });

  client.connect().catch((error: Error) => {
    state = 'down';
    trip(`conexão falhou: ${error.message}`);
  });

  // O Redis não pode segurar o processo no ar após o SIGTERM do Render.
  const shutdown = () => {
    try {
      client?.disconnect();
    } catch {
      // já desconectado
    }
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

export function redisCacheStatus(): RedisCacheState {
  return state;
}

/** Lê do cache. Retorna `null` em qualquer falha (o chamador vai no Postgres). */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!usable()) return null;
  try {
    const raw = await withTimeout(client!.get(key), OP_TIMEOUT_MS);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch (error) {
    trip(`GET falhou: ${(error as Error).message}`);
    return null;
  }
}

/** Grava no cache. Falha silenciosa: o dado continua no Postgres. */
export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  if (!usable()) return;
  try {
    await withTimeout(
      client!.set(key, JSON.stringify(value), 'EX', ttlSeconds),
      OP_TIMEOUT_MS,
    );
  } catch (error) {
    trip(`SET falhou: ${(error as Error).message}`);
  }
}

/** Monta a chave no padrão vendas:api:v1:<parte>:<parte>. */
export function cacheKey(...parts: string[]): string {
  return `${KEY_PREFIX}:${parts.join(':')}`;
}
