import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  ParseIntPipe,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { User, UserRole } from '../entities/user.entity';
import { StudentService } from './student.service';
import { UpdateLogbookDto } from '../logbooks/update-logbook.dto';
import { UpdateAiDeclarationDto } from '../ai-declarations/update-ai-declaration.dto';
import { SubmitEvidenceDto } from '../submissions/submit-evidence.dto';
import { UploadedAcademicFile } from '../submissions/submissions.service';

@Controller('student')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STUDENT)
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Get('activities')
  listActivities(
    @CurrentUser() user: User,
    @Query('filter') filter?: string,
  ) {
    return this.studentService.listActivities(user.id, filter);
  }

  @Get('activities/new-count')
  getNewActivityCount(@CurrentUser() user: User) {
    return this.studentService.getNewActivityCount(user.id);
  }

  @Patch('activities/:activityId/mark-viewed')
  markActivityViewed(
    @CurrentUser() user: User,
    @Param('activityId', ParseIntPipe) activityId: number,
  ) {
    return this.studentService.markActivityViewed(user.id, activityId);
  }

  @Get('activities/:activityId/logbook')
  getLogbook(
    @CurrentUser() user: User,
    @Param('activityId', ParseIntPipe) activityId: number,
  ) {
    return this.studentService.getLogbook(user.id, activityId);
  }

  @Put('activities/:activityId/logbook')
  updateLogbook(
    @CurrentUser() user: User,
    @Param('activityId', ParseIntPipe) activityId: number,
    @Body() input: UpdateLogbookDto,
  ) {
    return this.studentService.updateLogbook(user, activityId, input);
  }

  @Get('activities/:activityId/submission-status')
  getSubmissionStatus(
    @CurrentUser() user: User,
    @Param('activityId', ParseIntPipe) activityId: number,
  ) {
    return this.studentService.getSubmissionStatus(user.id, activityId);
  }

  @Get('activities/:activityId/ai-declaration')
  getAiDeclaration(
    @CurrentUser() user: User,
    @Param('activityId', ParseIntPipe) activityId: number,
  ) {
    return this.studentService.getAiDeclaration(user.id, activityId);
  }

  @Put('activities/:activityId/ai-declaration')
  updateAiDeclaration(
    @CurrentUser() user: User,
    @Param('activityId', ParseIntPipe) activityId: number,
    @Body() input: UpdateAiDeclarationDto,
  ) {
    return this.studentService.updateAiDeclaration(user, activityId, input);
  }

  @Put('activities/:activityId/submission')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 + 1 } }))
  submitEvidence(
    @CurrentUser() user: User,
    @Param('activityId', ParseIntPipe) activityId: number,
    @Body() input: SubmitEvidenceDto,
    @UploadedFile() file?: UploadedAcademicFile,
  ) {
    return this.studentService.submitEvidence(user, activityId, input, file);
  }

  @Get('activities/:activityId/results')
  getResults(
    @CurrentUser() user: User,
    @Param('activityId', ParseIntPipe) activityId: number,
  ) {
    return this.studentService.getResults(user.id, activityId);
  }

  @Get('classes/:classId/projection')
  getProjection(
    @CurrentUser() user: User,
    @Param('classId', ParseIntPipe) classId: number,
  ) {
    return this.studentService.getProjection(user.id, classId);
  }

  @Get('performance-chart')
  getPerformanceChart(
    @CurrentUser() user: User,
    @Query('classId') classIdStr?: string,
  ) {
    const classId = classIdStr ? parseInt(classIdStr, 10) : undefined;
    return this.studentService.getPerformanceChart(user.id, classId);
  }
}
