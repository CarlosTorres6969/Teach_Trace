import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Activity } from '../entities/activity.entity';
import { AiDeclaration } from '../entities/ai-declaration.entity';
import { Logbook } from '../entities/logbook.entity';
import { Rubric } from '../entities/rubric.entity';
import { Submission } from '../entities/submission.entity';
import { TeacherController } from './teacher.controller';
import { TeacherService } from './teacher.service';

@Module({
  imports: [TypeOrmModule.forFeature([Activity, Rubric, Submission, Logbook, AiDeclaration]), AuthModule],
  controllers: [TeacherController],
  providers: [TeacherService],
})
export class TeacherModule {}
