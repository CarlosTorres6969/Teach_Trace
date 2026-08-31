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
  Validate,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

@ValidatorConstraint({ name: 'uniqueLevelDescriptors', async: false })
class UniqueLevelDescriptorsConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    if (!value || typeof value !== 'object') return true;
    const descriptors = value as Record<string, unknown>;
    const levels = ['level1', 'level2', 'level3', 'level4'].map(
      (level) => descriptors[level],
    );
    if (levels.some((descriptor) => typeof descriptor !== 'string' || !descriptor.trim())) {
      return true;
    }
    const normalized = levels.map((descriptor) =>
      (descriptor as string).trim().toLowerCase(),
    );
    return new Set(normalized).size === normalized.length;
  }

  defaultMessage() {
    return 'Los descriptores de los niveles 1 al 4 deben ser diferentes';
  }
}

export class LevelDescriptorsDto {
  @Transform(trimString) @IsString() @MinLength(1) @MaxLength(1000) level1: string;
  @Transform(trimString) @IsString() @MinLength(1) @MaxLength(1000) level2: string;
  @Transform(trimString) @IsString() @MinLength(1) @MaxLength(1000) level3: string;
  @Transform(trimString) @IsString() @MinLength(1) @MaxLength(1000) level4: string;
}

export class RubricCriterionDto {
  @Transform(trimString) @IsString() @MinLength(1) @MaxLength(120) name: string;
  @Transform(trimString) @IsString() @MinLength(1) @MaxLength(120) dimension: string;
  @IsDefined()
  @Validate(UniqueLevelDescriptorsConstraint)
  @ValidateNested()
  @Type(() => LevelDescriptorsDto)
  descriptors: LevelDescriptorsDto;
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
