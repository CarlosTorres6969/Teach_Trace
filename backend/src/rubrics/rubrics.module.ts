import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivitiesModule } from '../activities/activities.module';
import { Activity } from '../entities/activity.entity';
import { Rubric } from '../entities/rubric.entity';
import { RubricsService } from './rubrics.service';

@Module({
  imports: [TypeOrmModule.forFeature([Rubric, Activity]), ActivitiesModule],
  providers: [RubricsService],
  exports: [RubricsService],
})
export class RubricsModule {}
