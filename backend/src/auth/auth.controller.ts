import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuthSession } from '../entities/auth-session.entity';
import { User } from '../entities/user.entity';
import { CurrentUser } from './current-user.decorator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginDto } from './login.dto';
import { LoginAttemptService } from './login-attempt.service';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from './security.config';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly loginAttempts: LoginAttemptService,
    private readonly config: ConfigService,
  ) {}

  @Post('login')
  async login(
    @Body() input: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const retryAfterSeconds = this.loginAttempts.retryAfterSeconds(input.email);
    if (retryAfterSeconds > 0) {
      response.setHeader('Retry-After', retryAfterSeconds.toString());
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Demasiados intentos de inicio de sesión. Intente nuevamente más tarde.',
          retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    try {
      const { accessToken, ...session } = await this.authService.login(input);
      this.loginAttempts.reset(input.email);
      response.cookie(SESSION_COOKIE_NAME, accessToken, {
        ...sessionCookieOptions(this.config),
        expires: session.expiresAt,
      });
      return session;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        this.loginAttempts.recordFailure(input.email);
      }
      throw error;
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: User) {
    return this.authService.safeUser(user);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() request: Request & { session: AuthSession },
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.logout(request.session);
    response.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions(this.config));
    return result;
  }
}
