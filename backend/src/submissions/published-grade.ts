import { Submission, SubmissionStatus } from '../entities/submission.entity';

export function explicitPublishedGrade(submission: Pick<Submission, 'status' | 'publishedGradePercentage'>): number | null {
  const grade = submission.publishedGradePercentage;
  return submission.status === SubmissionStatus.EVALUATED && typeof grade === 'number' &&
    Number.isFinite(grade) && grade >= 0 && grade <= 100 ? grade : null;
}

export function publishedGradeAsLevel(submission: Pick<Submission, 'status' | 'publishedGradePercentage'>): number | null {
  const grade = explicitPublishedGrade(submission);
  return grade === null ? null : 1 + grade * 3 / 100;
}
