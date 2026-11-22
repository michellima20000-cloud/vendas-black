import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length } from 'class-validator';

/**
 * Campo de texto opcional.
 *
 * Formulários HTML enviam `""` quando o usuário deixa o campo em branco, e o
 * `@IsOptional()` só ignora `null`/`undefined` — sem normalização, `""` cai no
 * `@Length(1, ...)` e derruba o pedido com erros como "notes must be longer
 * than or equal to 1 characters".
 *
 * Aqui a string vazia (ou só espaços) vira `undefined` antes da validação —
 * e o valor informado é aparado: campo não informado, guardado como `null`
 * no banco.
 */
export function OptionalText(minLength: number, maxLength: number) {
  return applyDecorators(
    Transform(({ value }) => {
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      return trimmed === '' ? undefined : trimmed;
    }),
    IsOptional(),
    IsString(),
    Length(minLength, maxLength),
  );
}
