import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

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
}

export class UpdateLearningOutcomesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  learningOutcomes: string[];
}
