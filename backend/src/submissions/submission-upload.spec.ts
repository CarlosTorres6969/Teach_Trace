import { JwtService } from '@nestjs/jwt';
import { SubmissionStatus } from '../entities/submission.entity';
import { SubmissionsService } from './submissions.service';

describe('Autorización de carga directa', () => {
  const tokens = new JwtService({ secret: 'clave-exclusiva-para-pruebas-de-carga' });
  const receipt = {
    purpose: 'submission-upload', studentId: 2, activityId: 4,
    key: 'azure:submissions/2/4/archivo.pdf', fileName: 'archivo.pdf', fileSize: 8,
  };
  const input = {
    productText: '', toolName: 'ChatGPT', usageLevel: 1,
    purpose: '', promptSummary: 'Resumen de prompts',
  };

  function services() {
    const submissions = { findOne: jest.fn().mockResolvedValue(null) };
    const activities = { getForStudent: jest.fn().mockResolvedValue({ id: 4 }) };
    const documents = {
      prepareUpload: jest.fn().mockResolvedValue({ key: receipt.key, uploadUrl: 'https://storage.example/file?sas' }),
      verifyUpload: jest.fn(),
    };
    const database = { transaction: jest.fn() };
    const service = new SubmissionsService(
      submissions as never,
      { findOne: jest.fn().mockResolvedValue({ initialIdeas: 'Idea', prompts: 'Prompt', validationsAndDecisions: 'Validación', finalReflection: 'Reflexión' }) } as never,
      {} as never, {} as never, database as never, activities as never, {} as never,
      documents as never,
      { getForStudent: jest.fn().mockResolvedValue({ messages: [{ role: 'student' }, { role: 'ai' }] }) } as never,
      undefined, tokens,
    );
    return { service, submissions, activities, documents, database };
  }

  it('firma una autorización vinculada al estudiante y la actividad con vencimiento', async () => {
    const { service } = services();
    const result = await service.prepareUpload({ id: 2 } as never, 4, { fileName: 'archivo.pdf', fileSize: 8 });
    expect(result.mode).toBe('direct');
    if (result.mode !== 'direct') throw new Error('Expected direct upload');
    const decoded = tokens.verify(result.uploadToken, { audience: 'submission-upload' });
    expect(decoded).toMatchObject(receipt);
    expect(decoded.exp - decoded.iat).toBe(900);
  });

  it('no emite URL si el estudiante no tiene acceso a la actividad', async () => {
    const { service, activities, documents } = services();
    activities.getForStudent.mockRejectedValue(new Error('No asignada'));
    await expect(service.prepareUpload({ id: 2 } as never, 4, { fileName: 'archivo.pdf', fileSize: 8 })).rejects.toThrow('No asignada');
    expect(documents.prepareUpload).not.toHaveBeenCalled();
  });

  it('no emite URL para reemplazar una entrega evaluada', async () => {
    const { service, submissions, documents } = services();
    submissions.findOne.mockResolvedValue({ status: SubmissionStatus.EVALUATED } as never);
    await expect(service.prepareUpload({ id: 2 } as never, 4, { fileName: 'archivo.pdf', fileSize: 8 })).rejects.toMatchObject({ status: 409 });
    expect(documents.prepareUpload).not.toHaveBeenCalled();
  });

  it('no autoriza descargar archivos de otro docente', async () => {
    const { service, submissions, activities, documents } = services();
    submissions.findOne.mockResolvedValue({ activity: { id: 4 }, fileName: 'archivo.pdf', fileStorageKey: receipt.key } as never);
    const ownedActivity = jest.fn().mockRejectedValue(new Error('No pertenece al docente'));
    Object.assign(activities, { ownedActivity });
    const downloadUrl = jest.fn();
    Object.assign(documents, { downloadUrl });
    await expect(service.getFileDownloadForTeacher(99, 8)).rejects.toThrow('No pertenece al docente');
    expect(downloadUrl).not.toHaveBeenCalled();
  });

  it.each(['student', 'activity', 'purpose', 'audience', 'expired', 'tampered'])('rechaza la autorización inválida (%s) sin modificar entregas', async (invalid) => {
    const { service, documents, database } = services();
    const payload = { ...receipt };
    if (invalid === 'student') payload.studentId = 3;
    if (invalid === 'activity') payload.activityId = 5;
    if (invalid === 'purpose') payload.purpose = 'access-token';
    let uploadToken = tokens.sign(payload, {
      audience: invalid === 'audience' ? 'other' : 'submission-upload',
      expiresIn: invalid === 'expired' ? -1 : '15m',
    });
    if (invalid === 'tampered') uploadToken = 'invalid.' + uploadToken;
    await expect(service.submit({ id: 2 } as never, 4, { ...input, uploadToken })).rejects.toMatchObject({ status: 400 });
    expect(documents.verifyUpload).not.toHaveBeenCalled();
    expect(database.transaction).not.toHaveBeenCalled();
  });
});
