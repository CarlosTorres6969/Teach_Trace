import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ActivityPhase } from '../entities/activity.entity';

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
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  learningOutcomes: string[];
}
