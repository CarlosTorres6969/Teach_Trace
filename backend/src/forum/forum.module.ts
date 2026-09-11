import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ClassesModule } from '../classes/classes.module';
import { AcademicClass } from '../entities/class.entity';
import { ForumPost } from '../entities/forum-post.entity';
import { ForumThread } from '../entities/forum-thread.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { ForumController } from './forum.controller';
import { ForumService } from './forum.service';

@Module({
  imports: [
    AuthModule,
    ClassesModule,
    NotificationsModule,
    TypeOrmModule.forFeature([ForumThread, ForumPost, AcademicClass]),
  ],
  controllers: [ForumController],
  providers: [ForumService],
})
export class ForumModule {}
