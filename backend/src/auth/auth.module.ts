import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthSession } from '../entities/auth-session.entity';
import { User } from '../entities/user.entity';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { AuthService } from './auth.service';
import { LoginAttemptService } from './login-attempt.service';
import { requiredJwtSecret } from './security.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, AuthSession]),
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: requiredJwtSecret(config),
        signOptions: { expiresIn: '8h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LoginAttemptService, JwtAuthGuard, RolesGuard],
  exports: [AuthService, JwtAuthGuard, RolesGuard, JwtModule, TypeOrmModule],
})
export class AuthModule {}
