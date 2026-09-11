import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { User, UserRole } from '../entities/user.entity';
import {
  CreateForumPostDto,
  CreateForumThreadDto,
  UpdatePinnedDto,
  UpdateResolvedDto,
} from './forum.dto';
import { ForumService } from './forum.service';

@Controller('forum')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STUDENT, UserRole.TEACHER)
export class ForumController {
  constructor(private readonly forumService: ForumService) {}

  @Get('classes/:classId/threads')
  listThreads(
    @CurrentUser() user: User,
    @Param('classId', ParseIntPipe) classId: number,
    @Query('page') page?: string,
    @Query('q') query?: string,
  ) {
    return this.forumService.listThreads(user, classId, Number(page ?? 1), query ?? '');
  }

  @Post('classes/:classId/threads')
  createThread(
    @CurrentUser() user: User,
    @Param('classId', ParseIntPipe) classId: number,
    @Body() input: CreateForumThreadDto,
  ) {
    return this.forumService.createThread(user, classId, input);
  }

  @Get('threads/:threadId')
  getThread(
    @CurrentUser() user: User,
    @Param('threadId', ParseIntPipe) threadId: number,
  ) {
    return this.forumService.getThread(user, threadId);
  }

  @Post('threads/:threadId/posts')
  createPost(
    @CurrentUser() user: User,
    @Param('threadId', ParseIntPipe) threadId: number,
    @Body() input: CreateForumPostDto,
  ) {
    return this.forumService.createPost(user, threadId, input);
  }

  @Patch('threads/:threadId/pinned')
  setPinned(
    @CurrentUser() user: User,
    @Param('threadId', ParseIntPipe) threadId: number,
    @Body() input: UpdatePinnedDto,
  ) {
    return this.forumService.setPinned(user, threadId, input.pinned);
  }

  @Patch('threads/:threadId/resolved')
  setResolved(
    @CurrentUser() user: User,
    @Param('threadId', ParseIntPipe) threadId: number,
    @Body() input: UpdateResolvedDto,
  ) {
    return this.forumService.setResolved(user, threadId, input.resolved);
  }

  @Delete('posts/:postId')
  deletePost(
    @CurrentUser() user: User,
    @Param('postId', ParseIntPipe) postId: number,
  ) {
    return this.forumService.deletePost(user, postId);
  }
}
