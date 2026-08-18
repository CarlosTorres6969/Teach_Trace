import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { Activity } from './entities/activity.entity';
import { AiDeclaration } from './entities/ai-declaration.entity';
import { AuthSession } from './entities/auth-session.entity';
import { Logbook } from './entities/logbook.entity';
import { Rubric } from './entities/rubric.entity';
import { Submission } from './entities/submission.entity';
import { User } from './entities/user.entity';
import { SeedService } from './seed.service';
import { StudentModule } from './student/student.module';
import { TeacherModule } from './teacher/teacher.module';

const entities = [User, AuthSession, Activity, Rubric, Logbook, AiDeclaration, Submission];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../.env', '.env'] }),
    TypeOrmModule.forRoot({
      type: 'sqljs',
      location: 'teachtrace.sqlite',
      autoSave: true,
      entities,
      synchronize: true,
    }),
    TypeOrmModule.forFeature([User, Activity, Rubric, Logbook, AiDeclaration, Submission]),
    AuthModule,
    StudentModule,
    TeacherModule,
  ],
  providers: [SeedService],
})
export class AppModule {}
