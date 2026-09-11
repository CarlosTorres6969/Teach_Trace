import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';

export interface SseBadgeEvent {
  userId: number;
  count: number;
}

@Injectable()
export class NotificationsSseService {
  private readonly subject = new Subject<SseBadgeEvent>();

  /** Llamado por NotificationsService cada vez que crea una notificación nueva */
  emit(userId: number, count: number) {
    this.subject.next({ userId, count });
  }

  /** Stream SSE filtrado por userId */
  streamForUser(userId: number): Observable<{ data: string }> {
    return this.subject.asObservable().pipe(
      filter((event) => event.userId === userId),
      map((event) => ({ data: JSON.stringify({ count: event.count }) })),
    );
  }
}
