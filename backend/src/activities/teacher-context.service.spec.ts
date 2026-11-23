import { JwtService } from '@nestjs/jwt';
import JSZip = require('jszip');
import pdfParse = require('pdf-parse');
import { TeacherContextService } from './teacher-context.service';

jest.mock('pdf-parse', () => jest.fn());

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

async function docx(text: string) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

describe('Contexto privado del docente', () => {
  const tokens = new JwtService({ secret: 'clave-solo-para-contexto-en-pruebas' });
  beforeEach(() => jest.mocked(pdfParse).mockResolvedValue({ text: 'Definición privada desde PDF' }));

  function setup() {
    const activities = {
      ownedActivity: jest.fn().mockResolvedValue({ id: 4, published: true }),
      getTeacherContext: jest.fn().mockResolvedValue(null),
      setTeacherContext: jest.fn().mockResolvedValue(undefined),
    };
    const documents = {
      prepareUpload: jest.fn().mockResolvedValue({ key: 'azure:teacher-context/2/4/contexto.docx', uploadUrl: 'https://storage.example/doc?sas' }),
      verifyDocumentUpload: jest.fn().mockResolvedValue({ key: 'azure:teacher-context/2/4/contexto.docx', size: 100 }),
      save: jest.fn().mockResolvedValue({ key: 'local:teacher-context/2/4/contexto' }),
      read: jest.fn(), downloadUrl: jest.fn().mockResolvedValue('https://storage.example/doc?read'),
    };
    return { activities, documents, service: new TeacherContextService(activities as never, documents as never, tokens) };
  }

  it.each(['pdf', 'docx'])('extrae texto del %s y devuelve solo metadatos', async (extension) => {
    const { service, activities, documents } = setup();
    const buffer = extension === 'pdf' ? Buffer.from('%PDF-1.4\ncontenido') : await docx('Definición privada desde Word');
    const result = await service.save(2, 4, {}, { originalname: `privado.${extension}`, mimetype: '', buffer, size: buffer.length });
    expect(result.document?.fileName).toBe(`privado.${extension}`);
    expect(JSON.stringify(result)).not.toContain('Definición privada');
    expect(JSON.stringify(result)).not.toContain('storageKey');
    expect(activities.setTeacherContext).toHaveBeenCalledWith(2, 4, expect.objectContaining({
      text: expect.stringContaining('Definición privada'),
      storageKey: 'local:teacher-context/2/4/contexto',
      mimeType: extension === 'pdf' ? 'application/pdf' : DOCX_MIME,
    }));
    expect(documents.save).toHaveBeenCalledTimes(1);
  });

  it('autoriza Word directo y valida el documento antes de guardarlo', async () => {
    const { service, documents, activities } = setup();
    const buffer = await docx('Contexto privado de la actividad');
    documents.read.mockResolvedValue(buffer);
    const authorization = await service.prepareUpload(2, 4, { fileName: 'contexto.docx', fileSize: buffer.length });
    expect(authorization.mode).toBe('direct');
    expect(authorization.mimeType).toBe(DOCX_MIME);
    if (authorization.mode !== 'direct') throw new Error('Expected direct upload');
    const receipt = tokens.verify(authorization.uploadToken, { audience: 'teacher-context' });
    expect(receipt.exp - receipt.iat).toBe(900);
    expect(receipt).toMatchObject({ teacherId: 2, activityId: 4, fileName: 'contexto.docx' });
    await service.save(2, 4, { uploadToken: authorization.uploadToken });
    expect(documents.verifyDocumentUpload).toHaveBeenCalledWith('azure:teacher-context/2/4/contexto.docx', 'teacher-context/2/4', buffer.length, DOCX_MIME);
    expect(documents.save).not.toHaveBeenCalled();
    expect(activities.setTeacherContext).toHaveBeenCalledWith(2, 4, expect.objectContaining({ text: 'Contexto privado de la actividad' }));
  });

  it.each(['owner', 'activity', 'audience', 'expired', 'tampered'])('rechaza una autorización inválida: %s', async (invalid) => {
    const { service, documents, activities } = setup();
    const receipt = { purpose: 'teacher-context', teacherId: invalid === 'owner' ? 3 : 2, activityId: invalid === 'activity' ? 5 : 4, key: 'azure:teacher-context/2/4/doc.pdf', fileName: 'doc.pdf', fileSize: 10 };
    let uploadToken = tokens.sign(receipt, { audience: invalid === 'audience' ? 'submission-upload' : 'teacher-context', expiresIn: invalid === 'expired' ? -1 : '15m' });
    if (invalid === 'tampered') uploadToken = `invalid.${uploadToken}`;
    await expect(service.save(2, 4, { uploadToken })).rejects.toMatchObject({ status: 400 });
    expect(documents.read).not.toHaveBeenCalled();
    expect(activities.setTeacherContext).not.toHaveBeenCalled();
  });

  it.each(['empty', 'invalid', 'too-long'])('conserva el contexto anterior si el PDF no es utilizable: %s', async (invalid) => {
    const { service, activities, documents } = setup();
    if (invalid === 'empty') jest.mocked(pdfParse).mockResolvedValue({ text: '   ' });
    if (invalid === 'invalid') jest.mocked(pdfParse).mockRejectedValue(new Error('encrypted'));
    if (invalid === 'too-long') jest.mocked(pdfParse).mockResolvedValue({ text: 'a'.repeat(100_001) });
    const buffer = Buffer.from('%PDF-1.4');
    await expect(service.save(2, 4, {}, { originalname: 'doc.pdf', mimetype: 'application/pdf', buffer, size: buffer.length })).rejects.toMatchObject({ status: 400 });
    expect(activities.setTeacherContext).not.toHaveBeenCalled();
    expect(documents.save).not.toHaveBeenCalled();
  });

  it('rechaza un ZIP que no es Word sin reemplazar el contexto', async () => {
    const { service, activities } = setup();
    const zip = new JSZip();
    zip.file('other.txt', 'No es Word');
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    await expect(service.save(2, 4, {}, { originalname: 'falso.docx', mimetype: DOCX_MIME, buffer, size: buffer.length })).rejects.toMatchObject({ status: 400 });
    expect(activities.setTeacherContext).not.toHaveBeenCalled();
  });

  it('rechaza un Word que excede el límite al descomprimirse', async () => {
    const { service, activities } = setup();
    const zip = new JSZip();
    zip.file('word/document.xml', Buffer.alloc(30 * 1024 * 1024 + 1, 32));
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    await expect(service.save(2, 4, {}, { originalname: 'expandido.docx', mimetype: DOCX_MIME, buffer, size: buffer.length })).rejects.toMatchObject({ status: 400 });
    expect(activities.setTeacherContext).not.toHaveBeenCalled();
  });

  it('comprueba propiedad antes de autorizar, guardar, retirar o descargar', async () => {
    const { service, activities, documents } = setup();
    activities.ownedActivity.mockRejectedValue(new Error('No pertenece'));
    activities.getTeacherContext.mockRejectedValue(new Error('No pertenece'));
    await expect(service.prepareUpload(99, 4, { fileName: 'doc.pdf', fileSize: 8 })).rejects.toThrow('No pertenece');
    await expect(service.save(99, 4, {})).rejects.toThrow('No pertenece');
    await expect(service.remove(99, 4)).rejects.toThrow('No pertenece');
    await expect(service.download(99, 4)).rejects.toThrow('No pertenece');
    expect(documents.prepareUpload).not.toHaveBeenCalled();
    expect(documents.downloadUrl).not.toHaveBeenCalled();
    expect(activities.setTeacherContext).not.toHaveBeenCalled();
  });
});
