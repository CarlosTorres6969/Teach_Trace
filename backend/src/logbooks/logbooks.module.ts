import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivitiesModule } from '../activities/activities.module';
import { Logbook } from '../entities/logbook.entity';
import { Submission } from '../entities/submission.entity';
import { LogbooksService } from './logbooks.service';

@Module({
  imports: [TypeOrmModule.forFeature([Logbook, Submission]), ActivitiesModule],
  providers: [LogbooksService],
  exports: [LogbooksService],
})
export class LogbooksModule {}
