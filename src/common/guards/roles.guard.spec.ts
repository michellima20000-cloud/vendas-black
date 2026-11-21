import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { Roles } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

class TestController {
  @Roles(Role.STORE_OWNER)
  restricted() {}

  open() {}
}

function runGuard(handler: () => void, user?: { role: Role }) {
  const guard = new RolesGuard(new Reflector());
  const context = {
    getHandler: () => handler,
    getClass: () => TestController,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;

  return guard.canActivate(context);
}

describe('RolesGuard', () => {
  it('permite acesso quando a rota não exige papéis', () => {
    expect(runGuard(TestController.prototype.open, { role: Role.CUSTOMER })).toBe(
      true,
    );
  });

  it('permite acesso quando o papel do usuário é aceito', () => {
    expect(
      runGuard(TestController.prototype.restricted, { role: Role.STORE_OWNER }),
    ).toBe(true);
  });

  it('bloqueia quando o papel do usuário não é aceito', () => {
    expect(() =>
      runGuard(TestController.prototype.restricted, { role: Role.CUSTOMER }),
    ).toThrow(ForbiddenException);
  });

  it('responde com mensagem em português quando o papel não é aceito', () => {
    expect(() =>
      runGuard(TestController.prototype.restricted, { role: Role.CUSTOMER }),
    ).toThrow('Você não tem permissão para realizar esta ação');
  });

  it('bloqueia requisição sem usuário autenticado', () => {
    expect(() => runGuard(TestController.prototype.restricted)).toThrow(
      UnauthorizedException,
    );
  });
});
