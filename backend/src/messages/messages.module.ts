import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ClassesModule } from '../classes/classes.module';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { Submission } from '../entities/submission.entity';
import { User } from '../entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { StudentMessagesController, TeacherMessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  imports: [
    AuthModule,
    ClassesModule,
    NotificationsModule,
    TypeOrmModule.forFeature([Conversation, Message, Submission, User]),
  ],
  controllers: [StudentMessagesController, TeacherMessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}
