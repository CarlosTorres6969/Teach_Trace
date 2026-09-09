import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { UserTheme } from '../entities/user.entity';

export class AccessibilitySettingsDto {
  @IsInt()
  @Min(100)
  @Max(150)
  fontSize: number;

  @IsBoolean()
  highContrast: boolean;

  @IsBoolean()
  reducedMotion: boolean;
}

export class UpdateUserPreferencesDto {
  @IsOptional()
  @IsEnum(UserTheme)
  theme?: UserTheme;

  @IsOptional()
  @ValidateNested()
  @Type(() => AccessibilitySettingsDto)
  accessibilitySettings?: AccessibilitySettingsDto;
}
