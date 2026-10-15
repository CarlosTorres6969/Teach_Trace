import { IsEnum } from 'class-validator';
import { UserRole } from '../entities/user.entity';

export class SwitchRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}
