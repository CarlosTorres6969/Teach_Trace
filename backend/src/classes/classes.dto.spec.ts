import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EnrollStudentsDto } from './classes.dto';

describe('EnrollStudentsDto', () => {
  it('normaliza el nombre y correo de cada estudiante', async () => {
    const dto = plainToInstance(EnrollStudentsDto, {
      students: [{ name: ' Ana Pérez ', email: ' ANA.PEREZ@UNAH.EDU.HN ' }],
    });

    expect(await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).toHaveLength(0);
    expect(dto.students).toEqual([
      expect.objectContaining({ name: 'Ana Pérez', email: 'ana.perez@unah.edu.hn' }),
    ]);
  });

  it.each([
    { students: [{ email: 'sin.nombre@unah.edu.hn' }] },
    { students: [{ name: '   ', email: 'sin.nombre@unah.edu.hn' }] },
    { students: [{ name: 'Nombre válido', email: 'correo-invalido' }] },
    { students: [] },
  ])('rechaza una importación incompleta o inválida: %p', async (input) => {
    const dto = plainToInstance(EnrollStudentsDto, input);

    expect(await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).not.toHaveLength(0);
  });
});
