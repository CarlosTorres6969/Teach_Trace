import { ConflictException } from '@nestjs/common';
import { Submission, SubmissionStatus } from '../entities/submission.entity';

export const EVALUATED_SUBMISSION_LOCK_MESSAGE =
  'La entrega ya fue evaluada y su evidencia no puede modificarse';

export function ensureSubmissionCanBeEdited(
  submission: Pick<Submission, 'status'> | null | undefined,
) {
  if (submission?.status === SubmissionStatus.EVALUATED) {
    throw new ConflictException(EVALUATED_SUBMISSION_LOCK_MESSAGE);
  }
}
