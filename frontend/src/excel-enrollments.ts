import type { Row } from 'read-excel-file';

const EMAIL_HEADERS = new Set([
  'correo',
  'email',
  'correoelectronico',
  'correoinstitucional',
  'emailinstitucional',
]);
const NAME_HEADERS = new Set([
  'nombre',
  'nombrecompleto',
  'nombreestudiante',
  'estudiante',
]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_STUDENT_NAME_LENGTH = 120;

export type EnrollmentStudent = {
  name: string;
  email: string;
};

export const MAX_BULK_ENROLLMENTS = 500;
export const MAX_ENROLLMENT_FILE_SIZE = 5 * 1024 * 1024;

export function extractEnrollmentStudents(rows: Row[]): EnrollmentStudent[] {
  const header = findEnrollmentHeaders(rows);
  if (!header) {
    throw new Error(
      'No se encontraron las columnas requeridas. Usa los encabezados nombre y correo.',
    );
  }

  const studentsByEmail = new Map<string, EnrollmentStudent>();
  const incompleteRows: number[] = [];
  const invalidEmailRows: number[] = [];
  const invalidNameRows: number[] = [];
  for (let rowIndex = header.rowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const name = String(rows[rowIndex]?.[header.nameColumnIndex] ?? '').trim();
    const email = String(rows[rowIndex]?.[header.emailColumnIndex] ?? '').trim().toLowerCase();
    if (!name && !email) continue;
    if (!name || !email) {
      incompleteRows.push(rowIndex + 1);
      continue;
    }
    if (name.length < 2 || name.length > MAX_STUDENT_NAME_LENGTH) {
      invalidNameRows.push(rowIndex + 1);
      continue;
    }
    if (!EMAIL_PATTERN.test(email)) {
      invalidEmailRows.push(rowIndex + 1);
      continue;
    }
    const duplicate = studentsByEmail.get(email);
    if (duplicate && duplicate.name.toLocaleLowerCase() !== name.toLocaleLowerCase()) {
      throw new Error(`El correo ${email} aparece con nombres diferentes en el archivo.`);
    }
    studentsByEmail.set(email, { name, email });
  }

  if (incompleteRows.length) {
    throw new Error(`Falta el nombre o el correo en las filas ${formatRows(incompleteRows)}.`);
  }
  if (invalidNameRows.length) {
    throw new Error(
      `Hay nombres inválidos en las filas ${formatRows(invalidNameRows)}. Deben tener entre 2 y ${MAX_STUDENT_NAME_LENGTH} caracteres.`,
    );
  }
  if (invalidEmailRows.length) {
    throw new Error(`Hay correos inválidos en las filas ${formatRows(invalidEmailRows)}. Corrígelos e intenta de nuevo.`);
  }

  const students = [...studentsByEmail.values()];
  if (!students.length) throw new Error('El archivo no contiene estudiantes para matricular.');
  if (students.length > MAX_BULK_ENROLLMENTS) {
    throw new Error(`Solo puedes importar hasta ${MAX_BULK_ENROLLMENTS} estudiantes por archivo.`);
  }
  return students;
}

function findEnrollmentHeaders(rows: Row[]) {
  const rowsToInspect = Math.min(rows.length, 10);
  for (let rowIndex = 0; rowIndex < rowsToInspect; rowIndex += 1) {
    const emailColumnIndex = rows[rowIndex].findIndex((cell) => EMAIL_HEADERS.has(normalizeHeader(cell)));
    const nameColumnIndex = rows[rowIndex].findIndex((cell) => NAME_HEADERS.has(normalizeHeader(cell)));
    if (emailColumnIndex >= 0 && nameColumnIndex >= 0) {
      return { rowIndex, emailColumnIndex, nameColumnIndex };
    }
  }
  return null;
}

function formatRows(rows: number[]) {
  return `${rows.slice(0, 5).join(', ')}${rows.length > 5 ? '…' : ''}`;
}

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
}
