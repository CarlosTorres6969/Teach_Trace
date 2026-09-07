import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivitiesModule } from '../activities/activities.module';
import { AuthModule } from '../auth/auth.module';
import { ClassesModule } from '../classes/classes.module';
import { Submission } from '../entities/submission.entity';
import { Valuation } from '../entities/valuation.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { RubricsModule } from '../rubrics/rubrics.module';
import { SubmissionsModule } from '../submissions/submissions.module';
import { TeacherController } from './teacher.controller';
import { TeacherValuationsService } from './teacher-valuations.service';
import { TeacherService } from './teacher.service';

@Module({
  imports: [
    AuthModule,
    ClassesModule,
    ActivitiesModule,
    RubricsModule,
    SubmissionsModule,
    NotificationsModule,
    TypeOrmModule.forFeature([Valuation, Submission]),
  ],
  controllers: [TeacherController],
  providers: [TeacherService, TeacherValuationsService],
})
export class TeacherModule {}
