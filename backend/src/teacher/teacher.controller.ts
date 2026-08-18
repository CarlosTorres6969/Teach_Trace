import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { CreateActivityDto, UpdateLearningOutcomesDto } from '../activities/activities.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateClassDto, EnrollStudentDto } from '../classes/classes.dto';
import { User, UserRole } from '../entities/user.entity';
import { AssociateRubricDto, CreateRubricDto } from '../rubrics/rubrics.dto';
import { SubmissionsService } from '../submissions/submissions.service';
import { TeacherService } from './teacher.service';

@Controller('teacher')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.TEACHER)
export class TeacherController {
  constructor(
    private readonly teacherService: TeacherService,
    private readonly submissionsService: SubmissionsService,
  ) {}

  @Get('classes')
  listClasses(@CurrentUser() user: User) {
    return this.teacherService.listClasses(user.id);
  }

  @Post('classes')
  createClass(@CurrentUser() user: User, @Body() input: CreateClassDto) {
    return this.teacherService.createClass(user, input);
  }

  @Get('classes/:classId/enrollments')
  listEnrollments(
    @CurrentUser() user: User,
    @Param('classId', ParseIntPipe) classId: number,
  ) {
    return this.teacherService.listEnrollments(user.id, classId);
  }

  @Post('classes/:classId/enrollments')
  enrollStudent(
    @CurrentUser() user: User,
    @Param('classId', ParseIntPipe) classId: number,
    @Body() input: EnrollStudentDto,
  ) {
    return this.teacherService.enrollStudent(user.id, classId, input.email);
  }

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

  @Get('submissions/:submissionId/file')
  async downloadSubmissionFile(
    @CurrentUser() user: User,
    @Param('submissionId', ParseIntPipe) submissionId: number,
    @Res() response: Response,
  ) {
    const file = await this.submissionsService.getFileForTeacher(user.id, submissionId);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    );
    response.send(file.content);
  }
}
