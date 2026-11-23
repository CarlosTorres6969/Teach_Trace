import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassesModule } from '../classes/classes.module';
import { Activity } from '../entities/activity.entity';
import { Enrollment } from '../entities/enrollment.entity';
import { ActivitiesService } from './activities.service';
import { TeacherContextService } from './teacher-context.service';
import { DocumentStorageModule } from '../documents/document-storage.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Activity, Enrollment]), ClassesModule, DocumentStorageModule, AuthModule],
  providers: [ActivitiesService, TeacherContextService],
  exports: [ActivitiesService, TeacherContextService],
})
export class ActivitiesModule {}
