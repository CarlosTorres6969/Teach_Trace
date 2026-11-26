import { explicitPublishedGrade, publishedGradeAsLevel } from './published-grade';
import { SubmissionStatus } from '../entities/submission.entity';
import { UpdatePublishedGradeDto } from '../teacher/update-published-grade.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

describe('Nota publicada directa', () => {
  it.each([0, 100, 90.48])('admite %s y conserva la escala de cálculo 1–4', async (grade) => {
    expect(await validate(plainToInstance(UpdatePublishedGradeDto, { gradePercentage: grade }))).toHaveLength(0);
    const submission = { status: SubmissionStatus.EVALUATED, publishedGradePercentage: grade };
    expect(explicitPublishedGrade(submission)).toBe(grade);
    expect(publishedGradeAsLevel(submission)).toBeCloseTo(1 + grade * 3 / 100);
  });
  it.each([-1, 101, 90.481, '90', null, undefined, NaN, Infinity])('rechaza una nota inválida', async (grade) => {
    expect(await validate(plainToInstance(UpdatePublishedGradeDto, { gradePercentage: grade }))).not.toHaveLength(0);
  });
  it('oculta la nota directa hasta que la entrega está publicada', () => {
    expect(explicitPublishedGrade({ status: SubmissionStatus.UNDER_REVIEW, publishedGradePercentage: 90 })).toBeNull();
  });
});
