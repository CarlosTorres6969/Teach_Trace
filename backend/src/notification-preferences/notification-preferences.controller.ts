import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from '../entities/user.entity';
import { UpdateNotificationPreferencesDto } from './notification-preferences.dto';
import { NotificationPreferencesService } from './notification-preferences.service';

@Controller('notification-preferences')
@UseGuards(JwtAuthGuard)
export class NotificationPreferencesController {
  constructor(private readonly notificationPreferences: NotificationPreferencesService) {}

  @Get()
  getPreferences(@CurrentUser() user: User) {
    return this.notificationPreferences.getForUser(user);
  }

  @Put()
  updatePreferences(
    @CurrentUser() user: User,
    @Body() input: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationPreferences.updateForUser(user, input);
  }
}
