import { TeacherContextService } from './teacher-context.service';
import { AiEngineService } from '../ai-engine/ai-engine.service';

function definitionPdf() {
  const stream = 'BT /F1 12 Tf 72 720 Td (Private task definition for testing) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += 'xref\n0 6\n0000000000 65535 f \n';
  pdf += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

describe('Lectura real de PDF sin sustitutos del parser', () => {
  it('extrae y conserva el texto de un PDF con la distribución CommonJS instalada', async () => {
    const setTeacherContext = jest.fn();
    const service = new TeacherContextService(
      { ownedActivity: jest.fn(), setTeacherContext } as never,
      { save: jest.fn().mockResolvedValue({ key: 'local:synthetic.pdf' }) } as never,
      {} as never,
    );
    const buffer = definitionPdf();
    const response = await service.save(2, 4, {}, { originalname: 'definicion.pdf', mimetype: 'application/pdf', buffer, size: buffer.length });
    expect(setTeacherContext).toHaveBeenCalledWith(2, 4, expect.objectContaining({ text: 'Private task definition for testing' }));
    expect(JSON.stringify(response)).not.toContain('Private task definition');
  });

  it('el motor de evaluación también puede leer el PDF real', async () => {
    const engine = new AiEngineService();
    const text = await (engine as unknown as { extractDocumentText: (document: { mimeType: string; content: Buffer }) => Promise<string> }).extractDocumentText({ mimeType: 'application/pdf', content: definitionPdf() });
    expect(text).toBe('Private task definition for testing');
  });
});
