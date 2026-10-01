import { describe, expect, it } from 'vitest';
import type { Row } from 'read-excel-file';
import { extractEnrollmentStudents } from './excel-enrollments';

describe('extractEnrollmentStudents', () => {
  it('extrae y normaliza nombre y correo desde el Excel', () => {
    const rows = [
      ['Nombre completo', 'Correo institucional'],
      [' Ana Pérez ', ' ANA.PEREZ@UNAH.EDU.HN '],
      ['Luis Gómez', 'luis.gomez@unah.edu.hn'],
    ] as Row[];

    expect(extractEnrollmentStudents(rows)).toEqual([
      { name: 'Ana Pérez', email: 'ana.perez@unah.edu.hn' },
      { name: 'Luis Gómez', email: 'luis.gomez@unah.edu.hn' },
    ]);
  });

  it('exige que la hoja tenga las columnas nombre y correo', () => {
    expect(() => extractEnrollmentStudents([
      ['Correo'],
      ['estudiante@unah.edu.hn'],
    ] as Row[])).toThrow('columnas requeridas');
  });

  it('rechaza filas que tengan solamente uno de los dos datos', () => {
    expect(() => extractEnrollmentStudents([
      ['Nombre', 'Correo'],
      ['Ana Pérez', ''],
    ] as Row[])).toThrow('filas 2');
  });

  it('rechaza correos inválidos y nombres fuera del límite', () => {
    expect(() => extractEnrollmentStudents([
      ['Nombre', 'Correo'],
      ['Ana Pérez', 'correo-invalido'],
    ] as Row[])).toThrow('correos inválidos');

    expect(() => extractEnrollmentStudents([
      ['Nombre', 'Correo'],
      ['A', 'ana@unah.edu.hn'],
    ] as Row[])).toThrow('nombres inválidos');
  });

  it('elimina filas duplicadas cuando conservan el mismo nombre y correo', () => {
    expect(extractEnrollmentStudents([
      ['Estudiante', 'Email'],
      ['Ana Pérez', 'ana@unah.edu.hn'],
      ['Ana Pérez', 'ANA@UNAH.EDU.HN'],
    ] as Row[])).toEqual([{ name: 'Ana Pérez', email: 'ana@unah.edu.hn' }]);
  });

  it('rechaza un correo repetido con nombres diferentes', () => {
    expect(() => extractEnrollmentStudents([
      ['Nombre', 'Correo'],
      ['Ana Pérez', 'ana@unah.edu.hn'],
      ['Otra Persona', 'ana@unah.edu.hn'],
    ] as Row[])).toThrow('aparece con nombres diferentes');
  });
});
