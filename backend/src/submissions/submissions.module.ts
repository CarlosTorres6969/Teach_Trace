import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivitiesModule } from '../activities/activities.module';
import { AiEngineModule } from '../ai-engine/ai-engine.module';
import { AuthModule } from '../auth/auth.module';
import { AiDeclaration } from '../entities/ai-declaration.entity';
import { Logbook } from '../entities/logbook.entity';
import { Submission } from '../entities/submission.entity';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Submission, Logbook, AiDeclaration]),
    ActivitiesModule,
    AiEngineModule,
    AuthModule,
  ],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
