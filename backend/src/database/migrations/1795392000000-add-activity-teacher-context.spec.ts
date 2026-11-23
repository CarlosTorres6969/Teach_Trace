import { QueryRunner } from 'typeorm';
import { AddActivityTeacherContext1795392000000 } from './1795392000000-add-activity-teacher-context';

describe('Migración del contexto privado', () => {
  it('agrega únicamente la columna opcional y conserva los datos al revertir', async () => {
    const query = jest.fn();
    const migration = new AddActivityTeacherContext1795392000000();
    await migration.up({ connection: { options: { type: 'postgres' } }, query } as unknown as QueryRunner);
    expect(query).toHaveBeenCalledWith('ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "teacherContextDocument" text NULL');
    await migration.down();
    expect(query).toHaveBeenCalledTimes(1);
  });
  it('deja el esquema de las pruebas SQLite en manos de TypeORM', async () => {
    const query = jest.fn();
    await new AddActivityTeacherContext1795392000000().up({ connection: { options: { type: 'sqljs' } }, query } as unknown as QueryRunner);
    expect(query).not.toHaveBeenCalled();
  });
});
