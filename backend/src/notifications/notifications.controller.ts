import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Res,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { User, UserRole } from '../entities/user.entity';
import {
  DeletePushSubscriptionDto,
  SavePushSubscriptionDto,
} from './notifications.dto';
import { NotificationsSseService } from './notifications-sse.service';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STUDENT)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly sseService: NotificationsSseService,
  ) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.notificationsService.listForUser(user.id);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: User) {
    return this.notificationsService.unreadCount(user.id).then((count) => ({ count }));
  }

  /** SSE: stream de badge en tiempo real — el cliente abre esta conexión una sola vez */
  @Sse('badge-stream')
  badgeStream(@CurrentUser() user: User, @Res() res: Response): Observable<{ data: string }> {
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    return this.sseService.streamForUser(user.id);
  }

  @Put(':id/read')
  markRead(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.notificationsService.markRead(user.id, id);
  }

  @Put('read-all')
  markAllRead(@CurrentUser() user: User) {
    return this.notificationsService.markAllRead(user.id);
  }

  // ─── Suscripciones push ───────────────────────────────────────────────────────

  @Post('push-subscriptions')
  saveSubscription(
    @CurrentUser() user: User,
    @Body() dto: SavePushSubscriptionDto,
  ) {
    return this.notificationsService.saveSubscription(user, dto);
  }

  @Delete('push-subscriptions')
  deleteSubscription(
    @CurrentUser() user: User,
    @Body() dto: DeletePushSubscriptionDto,
  ) {
    return this.notificationsService.deleteSubscription(user, dto.endpoint);
  }
}

@Controller('vapid-public-key')
export class VapidController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  getVapidPublicKey() {
    return { publicKey: this.notificationsService.getVapidPublicKey() };
  }
}
