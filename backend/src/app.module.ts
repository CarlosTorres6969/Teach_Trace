import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivitiesModule } from './activities/activities.module';
import { AiDeclarationsModule } from './ai-declarations/ai-declarations.module';
import { AiEngineModule } from './ai-engine/ai-engine.module';
import { AuthModule } from './auth/auth.module';
import { ClassesModule } from './classes/classes.module';
import { Activity } from './entities/activity.entity';
import { AiDeclaration } from './entities/ai-declaration.entity';
import { AuthSession } from './entities/auth-session.entity';
import { AcademicClass } from './entities/class.entity';
import { Enrollment } from './entities/enrollment.entity';
import { Indicator } from './entities/indicator.entity';
import { Logbook } from './entities/logbook.entity';
import { Rubric } from './entities/rubric.entity';
import { Submission } from './entities/submission.entity';
import { User } from './entities/user.entity';
import { Valuation } from './entities/valuation.entity';
import { EvaluationsModule } from './evaluations/evaluations.module';
import { IndicatorsModule } from './indicators/indicators.module';
import { LogbooksModule } from './logbooks/logbooks.module';
import { RubricsModule } from './rubrics/rubrics.module';
import { SeedService } from './seed.service';
import { StudentModule } from './student/student.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { TeacherModule } from './teacher/teacher.module';

const entities = [
  User,
  AuthSession,
  AcademicClass,
  Enrollment,
  Activity,
  Rubric,
  Logbook,
  AiDeclaration,
  Submission,
  Valuation,
  Indicator,
];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../.env', '.env'] }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databasePath = config.get<string>('DATABASE_PATH', 'teachtrace.sqlite');
        const inMemory = databasePath === ':memory:';
        return {
          type: 'sqljs' as const,
          ...(inMemory ? {} : { location: databasePath }),
          autoSave: !inMemory && config.get<string>('DATABASE_AUTOSAVE', 'true') === 'true',
          entities,
          synchronize: config.get<string>('DATABASE_SYNCHRONIZE', 'true') === 'true',
        };
      },
    }),
    TypeOrmModule.forFeature([
      User,
      AcademicClass,
      Enrollment,
      Activity,
      Rubric,
      Logbook,
      AiDeclaration,
      Submission,
    ]),
    AuthModule,
    ClassesModule,
    ActivitiesModule,
    RubricsModule,
    LogbooksModule,
    AiDeclarationsModule,
    SubmissionsModule,
    AiEngineModule,
    EvaluationsModule,
    IndicatorsModule,
    StudentModule,
    TeacherModule,
  ],
  providers: [SeedService],
})
export class AppModule {}
