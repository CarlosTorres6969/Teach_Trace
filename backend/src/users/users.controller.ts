import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from '../entities/user.entity';
import { UpdateUserPreferencesDto } from './update-user-preferences.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me/preferences')
  updatePreferences(
    @CurrentUser() user: User,
    @Body() input: UpdateUserPreferencesDto,
  ) {
    return this.usersService.updatePreferences(user, input);
  }
}
