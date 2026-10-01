import { UserRole } from '../entities/user.entity';
import { AdminBootstrapService } from './admin-bootstrap.service';

describe('AdminBootstrapService', () => {
  function setup(values: Record<string, string> = {}) {
    const users = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => ({ id: 1, ...value })),
      save: jest.fn(async (value) => value),
    };
    const authService = { hashPassword: jest.fn().mockResolvedValue('hash-admin') };
    const config = { get: jest.fn((key: string) => values[key]) };
    return {
      users,
      authService,
      service: new AdminBootstrapService(
        users as never,
        authService as never,
        config as never,
      ),
    };
  }

  it('crea una sola cuenta administradora inicial con cambio obligatorio', async () => {
    const { service, users, authService } = setup({
      ADMIN_EMAIL: ' ADMIN@UNAH.EDU.HN ',
      ADMIN_NAME: 'Administrador inicial',
      ADMIN_TEMPORARY_PASSWORD: 'TemporalAdmin123!',
    });

    await service.onApplicationBootstrap();

    expect(authService.hashPassword).toHaveBeenCalledWith('TemporalAdmin123!');
    expect(users.create).toHaveBeenCalledWith({
      email: 'admin@unah.edu.hn',
      name: 'Administrador inicial',
      passwordHash: 'hash-admin',
      role: UserRole.ADMIN,
      active: true,
      mustChangePassword: true,
    });
    expect(users.save).toHaveBeenCalledTimes(1);
  });

  it('no modifica la cuenta administradora cuando ya existe', async () => {
    const { service, users, authService } = setup({
      ADMIN_EMAIL: 'admin@unah.edu.hn',
      ADMIN_NAME: 'Administrador inicial',
      ADMIN_TEMPORARY_PASSWORD: 'TemporalAdmin123!',
    });
    users.findOne.mockResolvedValue({ id: 1, role: UserRole.ADMIN });

    await service.onApplicationBootstrap();

    expect(authService.hashPassword).not.toHaveBeenCalled();
    expect(users.save).not.toHaveBeenCalled();
  });

  it('rechaza una configuración parcial para no crear una cuenta inaccesible', async () => {
    const { service, users } = setup({
      ADMIN_EMAIL: 'admin@unah.edu.hn',
    });

    await expect(service.onApplicationBootstrap()).rejects.toThrow(
      'ADMIN_EMAIL, ADMIN_NAME y ADMIN_TEMPORARY_PASSWORD deben configurarse juntos',
    );
    expect(users.save).not.toHaveBeenCalled();
  });
});
