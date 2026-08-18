import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { User, UserRole } from '../entities/user.entity';
import { AssociateRubricDto, CreateActivityDto, CreateRubricDto, UpdateLearningOutcomesDto } from './teacher.dto';
import { TeacherService } from './teacher.service';

@Controller('teacher')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.TEACHER)
export class TeacherController {
  constructor(private readonly teacherService: TeacherService) {}

  @Get('activities')
  listActivities(@CurrentUser() user: User) {
    return this.teacherService.listActivities(user.id);
  }

  @Post('activities')
  createActivity(@CurrentUser() user: User, @Body() input: CreateActivityDto) {
    return this.teacherService.createActivity(user, input);
  }

  @Put('activities/:activityId/learning-outcomes')
  updateLearningOutcomes(
    @CurrentUser() user: User,
    @Param('activityId', ParseIntPipe) activityId: number,
    @Body() input: UpdateLearningOutcomesDto,
  ) {
    return this.teacherService.updateLearningOutcomes(user.id, activityId, input);
  }

  @Get('rubrics')
  listRubrics(@CurrentUser() user: User) {
    return this.teacherService.listRubrics(user.id);
  }

  @Post('rubrics')
  createRubric(@CurrentUser() user: User, @Body() input: CreateRubricDto) {
    return this.teacherService.createRubric(user, input);
  }

  @Put('activities/:activityId/rubric')
  associateRubric(
    @CurrentUser() user: User,
    @Param('activityId', ParseIntPipe) activityId: number,
    @Body() input: AssociateRubricDto,
  ) {
    return this.teacherService.associateRubric(user.id, activityId, input);
  }

  @Get('activities/:activityId/submissions')
  listSubmissions(
    @CurrentUser() user: User,
    @Param('activityId', ParseIntPipe) activityId: number,
  ) {
    return this.teacherService.listSubmissions(user.id, activityId);
  }

  @Get('submissions/:submissionId')
  getSubmission(
    @CurrentUser() user: User,
    @Param('submissionId', ParseIntPipe) submissionId: number,
  ) {
    return this.teacherService.getSubmission(user.id, submissionId);
  }
}
