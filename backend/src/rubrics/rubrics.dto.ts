import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDefined,
  IsInt,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class LevelDescriptorsDto {
  @Transform(trimString) @IsString() @MinLength(1) @MaxLength(1000) level1: string;
  @Transform(trimString) @IsString() @MinLength(1) @MaxLength(1000) level2: string;
  @Transform(trimString) @IsString() @MinLength(1) @MaxLength(1000) level3: string;
  @Transform(trimString) @IsString() @MinLength(1) @MaxLength(1000) level4: string;
}

export class RubricCriterionDto {
  @Transform(trimString) @IsString() @MinLength(1) @MaxLength(120) name: string;
  @Transform(trimString) @IsString() @MinLength(1) @MaxLength(120) dimension: string;
  @IsDefined() @ValidateNested() @Type(() => LevelDescriptorsDto) descriptors: LevelDescriptorsDto;
}

export class CreateRubricDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name: string;

  @IsArray()
  @ArrayMinSize(7)
  @ArrayMaxSize(7)
  @ArrayUnique(
    (criterion: RubricCriterionDto) =>
      typeof criterion?.name === 'string'
        ? criterion.name.trim().toLowerCase()
        : criterion?.name,
    { message: 'Los nombres de los criterios no pueden repetirse' },
  )
  @ArrayUnique(
    (criterion: RubricCriterionDto) =>
      typeof criterion?.dimension === 'string'
        ? criterion.dimension.trim().toLowerCase()
        : criterion?.dimension,
    { message: 'Las dimensiones no pueden repetirse' },
  )
  @IsDefined({ each: true })
  @ValidateNested({ each: true })
  @Type(() => RubricCriterionDto)
  criteria: RubricCriterionDto[];
}

export class AssociateRubricDto {
  @IsInt()
  @Min(1)
  rubricId: number;
}
