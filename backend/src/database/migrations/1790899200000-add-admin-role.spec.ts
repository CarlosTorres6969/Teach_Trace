import { QueryRunner } from 'typeorm';
import { AddAdminRole1790899200000 } from './1790899200000-add-admin-role';

describe('AddAdminRole1790899200000', () => {
  it('agrega el rol administrador al enum de PostgreSQL', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const queryRunner = {
      connection: { options: { type: 'postgres' } },
      query,
    } as unknown as QueryRunner;

    await new AddAdminRole1790899200000().up(queryRunner);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain('ALTER TYPE "users_role_enum"');
    expect(query.mock.calls[0][0]).toContain("'admin'");
  });

  it('deja que SQL.js sincronice el enum sin ejecutar SQL de PostgreSQL', async () => {
    const query = jest.fn();
    const queryRunner = {
      connection: { options: { type: 'sqljs' } },
      query,
    } as unknown as QueryRunner;

    await new AddAdminRole1790899200000().up(queryRunner);

    expect(query).not.toHaveBeenCalled();
  });
});
