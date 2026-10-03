import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ActivityPhase } from '../entities/activity.entity';

export const MAX_LEARNING_OUTCOMES = 20;
export const MAX_LEARNING_OUTCOME_LENGTH = 500;
export const MAX_AGENT_INSTRUCTIONS_LENGTH = 5000;

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateActivityDto {
  @Transform(trimString)
  @IsString()
  @Matches(/\S/u, { message: 'El título debe contener texto' })
  @MaxLength(160)
  title: string;

  @IsInt()
  @Min(1)
  classId: number;

  @IsDateString()
  dueDate: string;

  @Transform(trimString)
  @IsString()
  @Matches(/\S/u, { message: 'El tipo de actividad debe contener texto' })
  @MaxLength(80)
  activityType: string;

  // Compatibilidad con clientes anteriores. El nuevo flujo siempre usa la fase piloto.
  @IsOptional()
  @IsEnum(ActivityPhase)
  evaluationPhase?: ActivityPhase;

  @IsOptional()
  @IsInt()
  @Min(1)
  rubricId?: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(MAX_AGENT_INSTRUCTIONS_LENGTH)
  agentInstructions?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(100)
  weight?: number;
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
