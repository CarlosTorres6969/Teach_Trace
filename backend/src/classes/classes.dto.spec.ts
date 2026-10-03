import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateClassDto, EnrollStudentsDto } from './classes.dto';

describe('CreateClassDto', () => {
  it('acepta y normaliza nombre, sección, código y periodo académico', async () => {
    const dto = plainToInstance(CreateClassDto, {
      name: ' Tópicos Especiales y Avanzados ',
      section: ' 1200 ',
      code: ' IS-901 ',
      period: ' III PAC 2026 ',
    });

    expect(await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).toHaveLength(0);
    expect(dto).toMatchObject({
      name: 'Tópicos Especiales y Avanzados',
      section: '1200',
      code: 'IS-901',
      period: 'III PAC 2026',
    });
  });

  it.each([
    { name: '', section: '1200', code: 'IS-901', period: 'III PAC 2026' },
    { name: 'Tópicos Especiales', section: ' ', code: 'IS-901', period: 'III PAC 2026' },
    { name: 'Tópicos Especiales', section: '1200', code: ' ', period: 'III PAC 2026' },
    { name: 'Tópicos Especiales', section: '1200', code: 'IS-901', period: ' ' },
  ])('rechaza campos vacíos o formados por espacios: %p', async (input) => {
    const dto = plainToInstance(CreateClassDto, input);

    expect(await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).not.toHaveLength(0);
  });

  it('rechaza el contrato anterior con asignatura', async () => {
    const dto = plainToInstance(CreateClassDto, {
      name: 'Tópicos Especiales',
      subject: 'Asignatura anterior',
      code: 'IS-901',
      period: 'III PAC 2026',
    });

    expect(await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).not.toHaveLength(0);
  });
});

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
