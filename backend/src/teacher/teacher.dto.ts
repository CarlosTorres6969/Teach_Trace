import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateActivityDto {
  @IsString() @MaxLength(160) title: string;
  @IsString() @MaxLength(120) subject: string;
  @IsDateString() dueDate: string;
  @IsString() @MaxLength(80) activityType: string;
}

export class UpdateLearningOutcomesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  learningOutcomes: string[];
}

class LevelDescriptorsDto {
  @IsString() @MaxLength(1000) level1: string;
  @IsString() @MaxLength(1000) level2: string;
  @IsString() @MaxLength(1000) level3: string;
  @IsString() @MaxLength(1000) level4: string;
}

class RubricCriterionDto {
  @IsString() @MaxLength(120) name: string;
  @IsString() @MaxLength(120) dimension: string;
  @ValidateNested() @Type(() => LevelDescriptorsDto) descriptors: LevelDescriptorsDto;
}

export class CreateRubricDto {
  @IsString() @MaxLength(160) name: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => RubricCriterionDto)
  criteria: RubricCriterionDto[];
}

export class AssociateRubricDto {
  @IsInt() @Min(1) rubricId: number;
}
