import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivitiesModule } from '../activities/activities.module';
import { AiDeclaration } from '../entities/ai-declaration.entity';
import { Submission } from '../entities/submission.entity';
import { AiDeclarationsService } from './ai-declarations.service';

@Module({
  imports: [TypeOrmModule.forFeature([AiDeclaration, Submission]), ActivitiesModule],
  providers: [AiDeclarationsService],
  exports: [AiDeclarationsService],
})
export class AiDeclarationsModule {}
