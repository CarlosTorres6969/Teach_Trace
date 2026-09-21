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
import { ChangeTemporaryPasswordDto } from './change-temporary-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginDto } from './login.dto';
import { ConfirmPasswordResetDto, RequestPasswordResetDto } from './password-reset.dto';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from './security.config';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('password-reset/request')
  requestPasswordReset(@Body() input: RequestPasswordResetDto, @Req() request: Request) {
    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    return this.authService.requestPasswordReset(input, ip);
  }

  @Post('password-reset/confirm')
  confirmPasswordReset(@Body() input: ConfirmPasswordResetDto) {
    return this.authService.confirmPasswordReset(input);
  }

  @Post('temporary-password/change')
  @UseGuards(JwtAuthGuard)
  changeTemporaryPassword(
    @CurrentUser() user: User,
    @Req() request: Request & { session: AuthSession },
    @Body() input: ChangeTemporaryPasswordDto,
  ) {
    return this.authService.changeTemporaryPassword(user, request.session, input);
  }

  @Post('login')
  async login(
    @Body() input: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    try {
      const { accessToken, ...session } = await this.authService.login(input, ip);
      response.cookie(SESSION_COOKIE_NAME, accessToken, {
        ...sessionCookieOptions(this.config),
        expires: session.expiresAt,
      });
      return session;
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS) {
        const retryAfter = (error.getResponse() as any).retryAfterSeconds;
        response.setHeader('Retry-After', retryAfter.toString());
      }
      throw error;
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: User) {
    return this.authService.safeUser(user);
  }

  @Get('session')
  @UseGuards(JwtAuthGuard)
  session(@CurrentUser() user?: User) {
    return { user: user ? this.authService.safeUser(user) : null };
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
