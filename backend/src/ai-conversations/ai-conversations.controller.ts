import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { User, UserRole } from '../entities/user.entity';
import { UpdateAiConversationDto } from './ai-conversations.dto';
import { AiConversationsService } from './ai-conversations.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiConversationsController {
  constructor(private readonly conversations: AiConversationsService) {}

  @Get('student/activities/:activityId/ai-conversation')
  @Roles(UserRole.STUDENT)
  getStudentConversation(
    @CurrentUser() user: User,
    @Param('activityId', ParseIntPipe) activityId: number,
  ) {
    return this.conversations.getForStudent(user.id, activityId);
  }

  @Put('student/activities/:activityId/ai-conversation')
  @Roles(UserRole.STUDENT)
  saveStudentConversation(
    @CurrentUser() user: User,
    @Param('activityId', ParseIntPipe) activityId: number,
    @Body() input: UpdateAiConversationDto,
  ) {
    return this.conversations.saveForStudent(user, activityId, input);
  }

  @Get('teacher/submissions/:submissionId/ai-conversation')
  @Roles(UserRole.TEACHER)
  getTeacherConversation(
    @CurrentUser() user: User,
    @Param('submissionId', ParseIntPipe) submissionId: number,
  ) {
    return this.conversations.getForTeacher(user.id, submissionId);
  }

  @Get('teacher/submissions/:submissionId/ai-conversation/export')
  @Roles(UserRole.TEACHER)
  async exportTeacherConversation(
    @CurrentUser() user: User,
    @Param('submissionId', ParseIntPipe) submissionId: number,
    @Res() response: Response,
  ) {
    const file = await this.conversations.exportForTeacher(user.id, submissionId);
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    );
    response.send(file.content);
  }
}
