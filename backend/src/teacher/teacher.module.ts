import { Module } from '@nestjs/common';
import { ActivitiesModule } from '../activities/activities.module';
import { AuthModule } from '../auth/auth.module';
import { ClassesModule } from '../classes/classes.module';
import { RubricsModule } from '../rubrics/rubrics.module';
import { SubmissionsModule } from '../submissions/submissions.module';
import { TeacherController } from './teacher.controller';
import { TeacherService } from './teacher.service';

@Module({
  imports: [AuthModule, ClassesModule, ActivitiesModule, RubricsModule, SubmissionsModule],
  controllers: [TeacherController],
  providers: [TeacherService],
})
export class TeacherModule {}
