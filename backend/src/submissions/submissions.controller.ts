import { Controller, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { User, UserRole } from '../entities/user.entity';
import { SubmissionsService } from './submissions.service';

@Controller('entregas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.TEACHER)
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post('actividad/:activityId/evaluar')
  evaluateActivity(
    @CurrentUser() user: User,
    @Param('activityId', ParseIntPipe) activityId: number,
  ) {
    return this.submissionsService.evaluateActivity(user.id, activityId);
  }
}
