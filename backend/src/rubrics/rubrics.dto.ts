import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class LevelDescriptorsDto {
  @IsString() @MaxLength(1000) level1: string;
  @IsString() @MaxLength(1000) level2: string;
  @IsString() @MaxLength(1000) level3: string;
  @IsString() @MaxLength(1000) level4: string;
}

export class RubricCriterionDto {
  @IsString() @MaxLength(120) name: string;
  @IsString() @MaxLength(120) dimension: string;
  @ValidateNested() @Type(() => LevelDescriptorsDto) descriptors: LevelDescriptorsDto;
}

export class CreateRubricDto {
  @IsString()
  @MaxLength(160)
  name: string;

  @IsArray()
  @ArrayMinSize(7)
  @ArrayMaxSize(7)
  @ArrayUnique((criterion: RubricCriterionDto) =>
    typeof criterion?.dimension === 'string'
      ? criterion.dimension.trim().toLowerCase()
      : criterion?.dimension,
  )
  @ValidateNested({ each: true })
  @Type(() => RubricCriterionDto)
  criteria: RubricCriterionDto[];
}

export class AssociateRubricDto {
  @IsInt()
  @Min(1)
  rubricId: number;
}
