import { Transform } from 'class-transformer';
import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateAiDeclarationDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  toolName: string;

  @IsInt()
  @Min(1)
  @Max(3)
  usageLevel: number;

  @Transform(trimString)
  @IsString()
  @MaxLength(5000)
  purpose: string;

  @Transform(trimString)
  @IsString()
  @MaxLength(10000)
  promptSummary: string;
}
