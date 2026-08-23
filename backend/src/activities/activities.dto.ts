import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ActivityPhase } from '../entities/activity.entity';

export const MAX_LEARNING_OUTCOMES = 20;
export const MAX_LEARNING_OUTCOME_LENGTH = 500;

export class CreateActivityDto {
  @IsString()
  @MaxLength(160)
  title: string;

  @IsInt()
  @Min(1)
  classId: number;

  @IsDateString()
  dueDate: string;

  @IsString()
  @MaxLength(80)
  activityType: string;

  @IsEnum(ActivityPhase)
  evaluationPhase: ActivityPhase;
}

export class UpdateLearningOutcomesDto {
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((outcome) => (typeof outcome === 'string' ? outcome.trim() : outcome))
      : value,
  )
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_LEARNING_OUTCOMES)
  @IsString({ each: true })
  @Matches(/\S/u, {
    each: true,
    message: 'Cada resultado de aprendizaje debe contener texto',
  })
  @MaxLength(MAX_LEARNING_OUTCOME_LENGTH, {
    each: true,
    message: `Cada resultado de aprendizaje puede tener hasta ${MAX_LEARNING_OUTCOME_LENGTH} caracteres`,
  })
  learningOutcomes: string[];
}
