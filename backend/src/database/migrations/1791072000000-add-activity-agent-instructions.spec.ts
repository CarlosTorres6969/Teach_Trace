import { QueryRunner } from 'typeorm';
import { AddActivityAgentInstructions1791072000000 } from './1791072000000-add-activity-agent-instructions';

describe('AddActivityAgentInstructions1791072000000', () => {
  it('agrega las instrucciones del agente en PostgreSQL', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const queryRunner = {
      connection: { options: { type: 'postgres' } },
      query,
    } as unknown as QueryRunner;

    await new AddActivityAgentInstructions1791072000000().up(queryRunner);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain('"agentInstructions" text');
  });

  it('no ejecuta cambios manuales en SQL.js', async () => {
    const query = jest.fn();
    const queryRunner = {
      connection: { options: { type: 'sqljs' } },
      query,
    } as unknown as QueryRunner;

    await new AddActivityAgentInstructions1791072000000().up(queryRunner);

    expect(query).not.toHaveBeenCalled();
  });
});
