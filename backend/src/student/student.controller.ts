import { Body, Controller, Get, Param, ParseIntPipe, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { User, UserRole } from '../entities/user.entity';
import { StudentService } from './student.service';
import { UpdateLogbookDto } from './update-logbook.dto';
import { UpdateAiDeclarationDto } from './update-ai-declaration.dto';
import { SubmitProductDto } from './submit-product.dto';

@Controller('student')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STUDENT)
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Get('activities')
  listActivities(@CurrentUser() user: User) {
    return this.studentService.listActivities(user.id);
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
  submitProduct(
    @CurrentUser() user: User,
    @Param('activityId', ParseIntPipe) activityId: number,
    @Body() input: SubmitProductDto,
  ) {
    return this.studentService.submitProduct(user, activityId, input);
  }
}
