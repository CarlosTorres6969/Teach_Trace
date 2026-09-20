import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivitiesModule } from './activities/activities.module';
import { AiDeclarationsModule } from './ai-declarations/ai-declarations.module';
import { AiConversationsModule } from './ai-conversations/ai-conversations.module';
import { AiEngineModule } from './ai-engine/ai-engine.module';
import { AuthModule } from './auth/auth.module';
import { ClassesModule } from './classes/classes.module';
import { Activity } from './entities/activity.entity';
import { AiDeclaration } from './entities/ai-declaration.entity';
import { AiConversation, AiMessage } from './entities/ai-conversation.entity';
import { AuthSession } from './entities/auth-session.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { AcademicClass } from './entities/class.entity';
import { Enrollment } from './entities/enrollment.entity';
import { Indicator } from './entities/indicator.entity';
import { Logbook } from './entities/logbook.entity';
import { Notification } from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { PushSubscriptionEntity } from './entities/push-subscription.entity';
import { Rubric } from './entities/rubric.entity';
import { Submission } from './entities/submission.entity';
import { User } from './entities/user.entity';
import { Valuation } from './entities/valuation.entity';
import { EvaluationsModule } from './evaluations/evaluations.module';
import { IndicatorsModule } from './indicators/indicators.module';
import { LogbooksModule } from './logbooks/logbooks.module';
import { NotificationPreferencesModule } from './notification-preferences/notification-preferences.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RubricsModule } from './rubrics/rubrics.module';
import { SeedService } from './seed.service';
import { StudentModule } from './student/student.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { TeacherModule } from './teacher/teacher.module';
import { UsersModule } from './users/users.module';

const entities = [
  User,
  AuthSession,
  PasswordResetToken,
  AcademicClass,
  Enrollment,
  Activity,
  Rubric,
  Logbook,
  AiDeclaration,
  AiConversation,
  AiMessage,
  Submission,
  Valuation,
  Indicator,
  NotificationPreference,
  Notification,
  PushSubscriptionEntity,
];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../.env', '.env'] }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get<string>('DATABASE_URL')?.trim();
        const synchronize = config.get<string>(
          'DATABASE_SYNCHRONIZE',
          databaseUrl ? 'false' : 'true',
        ) === 'true';

        if (databaseUrl) {
          return {
            type: 'postgres' as const,
            url: databaseUrl,
            // Supabase requires TLS for its hosted PostgreSQL connections.
            ssl:
              config.get<string>('DATABASE_SSL', 'true') === 'true'
                ? { rejectUnauthorized: false }
                : false,
            entities,
            synchronize,
          };
        }

        const databasePath = config.get<string>('DATABASE_PATH', 'teachtrace.sqlite');
        const inMemory = databasePath === ':memory:';
        return {
          type: 'sqljs' as const,
          ...(inMemory ? {} : { location: databasePath }),
          autoSave: !inMemory && config.get<string>('DATABASE_AUTOSAVE', 'true') === 'true',
          entities,
          synchronize,
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
      AiConversation,
      AiMessage,
      Submission,
      Valuation,
      Notification,
    ]),
    AuthModule,
    ClassesModule,
    ActivitiesModule,
    RubricsModule,
    LogbooksModule,
    NotificationPreferencesModule,
    NotificationsModule,
    AiDeclarationsModule,
    AiConversationsModule,
    SubmissionsModule,
    AiEngineModule,
    EvaluationsModule,
    IndicatorsModule,
    StudentModule,
    TeacherModule,
    UsersModule,
  ],
  providers: [SeedService],
})
export class AppModule {}
