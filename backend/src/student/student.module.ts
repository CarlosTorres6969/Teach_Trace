import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Activity } from '../entities/activity.entity';
import { Logbook } from '../entities/logbook.entity';
import { Submission } from '../entities/submission.entity';
import { AiDeclaration } from '../entities/ai-declaration.entity';
import { StudentController } from './student.controller';
import { StudentService } from './student.service';

@Module({
  imports: [TypeOrmModule.forFeature([Activity, Logbook, Submission, AiDeclaration]), AuthModule],
  controllers: [StudentController],
  providers: [StudentService],
})
export class StudentModule {}
