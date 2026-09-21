import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivitiesModule } from '../activities/activities.module';
import { AiConversationsModule } from '../ai-conversations/ai-conversations.module';
import { AiEngineModule } from '../ai-engine/ai-engine.module';
import { AuthModule } from '../auth/auth.module';
import { AiDeclaration } from '../entities/ai-declaration.entity';
import { Logbook } from '../entities/logbook.entity';
import { Submission } from '../entities/submission.entity';
import { Valuation } from '../entities/valuation.entity';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';
import { DocumentRepositoryService } from './document-repository.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Submission, Logbook, AiDeclaration, Valuation]),
    ActivitiesModule,
    AiConversationsModule,
    AiEngineModule,
    AuthModule,
    NotificationsModule,
  ],
  controllers: [SubmissionsController],
  providers: [SubmissionsService, DocumentRepositoryService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
