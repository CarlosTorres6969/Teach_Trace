import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { User, UserRole } from '../entities/user.entity';
import { CreateConversationDto, ReplyMessageDto } from './messages.dto';
import { MessagesService } from './messages.service';

// ─── Endpoints del estudiante ─────────────────────────────────────────────────

@Controller('student/messages')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STUDENT)
export class StudentMessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateConversationDto) {
    return this.messagesService.createConversation(user, dto);
  }

  @Get()
  list(@CurrentUser() user: User) {
    return this.messagesService.listForStudent(user.id);
  }

  @Get(':id')
  getThread(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.messagesService.getThread(id, user.id);
  }

  @Post(':id/reply')
  reply(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReplyMessageDto,
  ) {
    return this.messagesService.reply(id, user, dto);
  }
}

// ─── Endpoints del docente ────────────────────────────────────────────────────

@Controller('teacher/messages')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.TEACHER)
export class TeacherMessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.messagesService.listForTeacher(user.id);
  }

  @Get(':id')
  getThread(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.messagesService.getThread(id, user.id);
  }

  @Post(':id/reply')
  reply(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReplyMessageDto,
  ) {
    return this.messagesService.reply(id, user, dto);
  }

  @Put(':id/resolve')
  resolve(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.messagesService.resolve(id, user.id);
  }
}
