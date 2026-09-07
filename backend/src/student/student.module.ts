import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivitiesModule } from '../activities/activities.module';
import { AiDeclarationsModule } from '../ai-declarations/ai-declarations.module';
import { AuthModule } from '../auth/auth.module';
import { Submission } from '../entities/submission.entity';
import { Valuation } from '../entities/valuation.entity';
import { LogbooksModule } from '../logbooks/logbooks.module';
import { SubmissionsModule } from '../submissions/submissions.module';
import { StudentController } from './student.controller';
import { StudentService } from './student.service';

@Module({
  imports: [
    AuthModule,
    ActivitiesModule,
    LogbooksModule,
    AiDeclarationsModule,
    SubmissionsModule,
    TypeOrmModule.forFeature([Submission, Valuation]),
  ],
  controllers: [StudentController],
  providers: [StudentService],
})
export class StudentModule {}
