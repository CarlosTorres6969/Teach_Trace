import type { Row } from 'read-excel-file';

const EMAIL_HEADERS = new Set([
  'correo',
  'email',
  'correoelectronico',
  'correoinstitucional',
  'emailinstitucional',
]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MAX_BULK_ENROLLMENTS = 500;
export const MAX_ENROLLMENT_FILE_SIZE = 5 * 1024 * 1024;

export function extractEnrollmentEmails(rows: Row[]): string[] {
  const header = findEmailHeader(rows);
  if (!header) {
    throw new Error(
      'No se encontró la columna de correos. Usa como encabezado: correo, email o correo institucional.',
    );
  }

  const emails: string[] = [];
  const invalidRows: number[] = [];
  for (let rowIndex = header.rowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const value = rows[rowIndex]?.[header.columnIndex];
    if (value == null || String(value).trim() === '') continue;
    const email = String(value).trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
      invalidRows.push(rowIndex + 1);
      continue;
    }
    emails.push(email);
  }

  if (invalidRows.length) {
    const displayedRows = invalidRows.slice(0, 5).join(', ');
    const suffix = invalidRows.length > 5 ? '…' : '';
    throw new Error(`Hay correos inválidos en las filas ${displayedRows}${suffix}. Corrígelos e intenta de nuevo.`);
  }

  const uniqueEmails = [...new Set(emails)];
  if (!uniqueEmails.length) throw new Error('El archivo no contiene correos de estudiantes.');
  if (uniqueEmails.length > MAX_BULK_ENROLLMENTS) {
    throw new Error(`Solo puedes importar hasta ${MAX_BULK_ENROLLMENTS} estudiantes por archivo.`);
  }
  return uniqueEmails;
}

function findEmailHeader(rows: Row[]) {
  const rowsToInspect = Math.min(rows.length, 10);
  for (let rowIndex = 0; rowIndex < rowsToInspect; rowIndex += 1) {
    const columnIndex = rows[rowIndex].findIndex((cell) => EMAIL_HEADERS.has(normalizeHeader(cell)));
    if (columnIndex >= 0) return { rowIndex, columnIndex };
  }
  return null;
}

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
}
