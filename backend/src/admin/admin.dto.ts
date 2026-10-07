import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDefined, IsEmail, IsObject, IsString, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { API_KEY_FORMAT_MESSAGE } from '../ai-engine/ai-api-key-validator.service';

export class AiStageInstructionsDto {
  @IsString() @MinLength(1) @MaxLength(5000)
  aiUsage: string;

  @IsString() @MinLength(1) @MaxLength(5000)
  suggestedGrade: string;

  @IsString() @MinLength(1) @MaxLength(5000)
  feedback: string;

  @IsString() @MinLength(1) @MaxLength(5000)
  understanding: string;

  @IsString() @MinLength(1) @MaxLength(5000)
  indicators: string;
}

export class UpdateAiApiKeyDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString({ message: API_KEY_FORMAT_MESSAGE })
  @Matches(/^[\x21-\x7e]{20,4096}$/, { message: API_KEY_FORMAT_MESSAGE })
  apiKey: string;
}

export class UpdateAiStageSettingsDto {
  @IsString() @MinLength(1) @MaxLength(200)
  model: string;

  @IsBoolean()
  enabled: boolean;

  @IsString() @MinLength(1) @MaxLength(19500)
  instructions: string;

  @IsDefined() @IsObject() @ValidateNested() @Type(() => AiStageInstructionsDto)
  stageInstructions: AiStageInstructionsDto;
}

export class UpdateAiEngineSettingsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  markdown: string;
}

export class CreateTeacherDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;
}
