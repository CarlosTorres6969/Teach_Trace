import { QueryRunner } from 'typeorm';
import { AddClassSection1790985600000 } from './1790985600000-add-class-section';

describe('AddClassSection1790985600000', () => {
  it('agrega la sección de la clase en PostgreSQL sin eliminar datos anteriores', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const queryRunner = {
      connection: { options: { type: 'postgres' } },
      query,
    } as unknown as QueryRunner;

    await new AddClassSection1790985600000().up(queryRunner);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain('ADD COLUMN IF NOT EXISTS "section"');
    expect(query.mock.calls[0][0]).not.toContain('DROP COLUMN');
  });

  it('deja que synchronize administre la columna en SQL.js', async () => {
    const query = jest.fn();
    const queryRunner = {
      connection: { options: { type: 'sqljs' } },
      query,
    } as unknown as QueryRunner;

    await new AddClassSection1790985600000().up(queryRunner);

    expect(query).not.toHaveBeenCalled();
  });
});
