export type Role = 'student' | 'teacher';

export type User = {
  id: number;
  email: string;
  name: string;
  role: Role;
};

export type AcademicClass = {
  id: number;
  name: string;
  subject: string;
  code: string;
  period: string;
  studentCount: number;
  students: Array<{ id: number; name: string; email: string }>;
};

export type Activity = {
  id: number;
  title: string;
  subject: string;
  academicClass?: Pick<AcademicClass, 'id' | 'name' | 'code'> | null;
  dueDate?: string;
  activityType?: string;
  learningOutcomes?: string[];
  submissionStatus?: string;
  rubric?: Rubric | null;
};

export type Criterion = {
  name: string;
  dimension: string;
  descriptors: { level1: string; level2: string; level3: string; level4: string };
};

export type Rubric = { id: number; name: string; criteria: Criterion[] };
