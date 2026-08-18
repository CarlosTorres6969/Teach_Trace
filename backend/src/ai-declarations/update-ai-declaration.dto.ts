import { Type } from 'class-transformer';
import { IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateAiDeclarationDto {
  @IsString()
  @MaxLength(120)
  toolName: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  usageLevel: number;

  @IsString()
  @MaxLength(5000)
  purpose: string;

  @IsString()
  @MaxLength(10000)
  promptSummary: string;
}
