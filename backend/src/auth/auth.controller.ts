import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthSession } from '../entities/auth-session.entity';
import { User } from '../entities/user.entity';
import { CurrentUser } from './current-user.decorator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginDto } from './login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() input: LoginDto) {
    return this.authService.login(input);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: User) {
    return this.authService.safeUser(user);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@Req() request: Request & { session: AuthSession }) {
    return this.authService.logout(request.session);
  }
}
