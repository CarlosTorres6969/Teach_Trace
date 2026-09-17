import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivitiesModule } from '../activities/activities.module';
import { AiConversation, AiMessage } from '../entities/ai-conversation.entity';
import { Submission } from '../entities/submission.entity';
import { AuthModule } from '../auth/auth.module';
import { AiConversationsController } from './ai-conversations.controller';
import { AiConversationsService } from './ai-conversations.service';

@Module({
  imports: [
    AuthModule,
    ActivitiesModule,
    TypeOrmModule.forFeature([AiConversation, AiMessage, Submission]),
  ],
  controllers: [AiConversationsController],
  providers: [AiConversationsService],
  exports: [AiConversationsService],
})
export class AiConversationsModule {}
