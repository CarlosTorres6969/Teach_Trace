import { IsEnum } from 'class-validator';
import { UserTheme } from '../entities/user.entity';

export class UpdateUserPreferencesDto {
  @IsEnum(UserTheme)
  theme: UserTheme;
}
