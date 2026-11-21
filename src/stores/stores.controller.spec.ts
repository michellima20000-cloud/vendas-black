import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ROLES_KEY, RolesGuard } from '../common/guards/roles.guard';
import { StoresController } from './stores.controller';

const GUARDS_METADATA = '__guards__';

describe('StoresController', () => {
  describe('GET /stores/mine', () => {
    const handler = StoresController.prototype.myStore;

    it('não exige papel de lojista, para cliente sem loja receber 404', () => {
      expect(Reflect.getMetadata(ROLES_KEY, handler)).toBeUndefined();
    });

    it('continua exigindo autenticação', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[];
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).not.toContain(RolesGuard);
    });
  });

  describe('rotas de escrita da minha loja', () => {
    it('exige papel de lojista para atualizar a loja', () => {
      expect(
        Reflect.getMetadata(ROLES_KEY, StoresController.prototype.update),
      ).toEqual([Role.STORE_OWNER]);
    });

    it('exige papel de lojista para atualizar o tema', () => {
      expect(
        Reflect.getMetadata(ROLES_KEY, StoresController.prototype.updateTheme),
      ).toEqual([Role.STORE_OWNER]);
    });
  });
});
