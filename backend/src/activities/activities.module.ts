import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassesModule } from '../classes/classes.module';
import { Activity } from '../entities/activity.entity';
import { Enrollment } from '../entities/enrollment.entity';
import { ActivitiesService } from './activities.service';

@Module({
  imports: [TypeOrmModule.forFeature([Activity, Enrollment]), ClassesModule],
  providers: [ActivitiesService],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
