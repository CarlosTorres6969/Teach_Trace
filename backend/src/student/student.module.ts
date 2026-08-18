import { Module } from '@nestjs/common';
import { ActivitiesModule } from '../activities/activities.module';
import { AiDeclarationsModule } from '../ai-declarations/ai-declarations.module';
import { AuthModule } from '../auth/auth.module';
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
  ],
  controllers: [StudentController],
  providers: [StudentService],
})
export class StudentModule {}
