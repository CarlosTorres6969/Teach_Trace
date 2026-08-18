import { IsString, MaxLength } from 'class-validator';

export class UpdateLogbookDto {
  @IsString()
  @MaxLength(10000)
  initialIdeas: string;

  @IsString()
  @MaxLength(20000)
  prompts: string;

  @IsString()
  @MaxLength(20000)
  validationsAndDecisions: string;

  @IsString()
  @MaxLength(10000)
  finalReflection: string;
}
