import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { AuthSession } from '../entities/auth-session.entity';
import { Notification, NotificationType } from '../entities/notification.entity';
import { User, UserRole } from '../entities/user.entity';
import { NotificationsService } from './notifications.service';

describe.each([true, false])('Notificaciones con columnas históricas ausentes=%s', (missingLegacyColumns) => {
  let source: DataSource;
  let repository: Repository<Notification>;
  let service: NotificationsService;
  let recipient: User;
  let otherUser: User;

  beforeAll(async () => {
    source = await new DataSource({
      type: 'sqljs',
      entities: [User, AuthSession, Notification],
      synchronize: true,
    }).initialize();
    if (missingLegacyColumns) {
      for (const column of ['conversationId', 'forumThreadId', 'classId']) {
        await source.query(`ALTER TABLE "notifications" DROP COLUMN "${column}"`);
      }
    }
    repository = source.getRepository(Notification);
    const users = source.getRepository(User);
    [recipient, otherUser] = await users.save([
      users.create({ name: 'Estudiante', email: 'uno@example.test', passwordHash: 'test-only', role: UserRole.STUDENT }),
      users.create({ name: 'Otro estudiante', email: 'dos@example.test', passwordHash: 'test-only', role: UserRole.STUDENT }),
    ]);
    service = new NotificationsService(
      repository,
      {} as never,
      { isChannelEnabled: jest.fn().mockResolvedValue(false) } as never,
      new ConfigService({}),
      {} as never,
      { emit: jest.fn() } as never,
    );
  });

  afterAll(async () => { await source?.destroy(); });

  beforeEach(async () => { await repository.clear(); });

  it('crea, lista, cuenta y marca notificaciones sin consultar ni escribir referencias retiradas', async () => {
    const grade = await service.dispatchGradePublished(recipient, 'Actividad', 4);
    await service.dispatchAiAnalysisReady(recipient, otherUser, 'Actividad', 4, false);
    await service.dispatchGradePublished(otherUser, 'Actividad ajena', 5);
    await repository.save(repository.create({
      user: recipient, type: NotificationType.GRADE_PUBLISHED, title: 'Antigua', message: 'Antigua',
      createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000), read: false,
    }));

    expect(await service.unreadCount(recipient.id)).toBe(2);
    const listed = await service.listForUser(recipient.id);
    expect(listed).toHaveLength(2);
    expect(listed.map((item) => item.type)).toEqual(expect.arrayContaining([
      NotificationType.GRADE_PUBLISHED, NotificationType.AI_ANALYSIS_READY,
    ]));
    expect(listed.find((item) => item.id === grade.id)?.activityId).toBe(4);
    await expect(service.markRead(otherUser.id, grade.id)).rejects.toThrow('Notificación no encontrada');
    expect(await service.markRead(recipient.id, grade.id)).toMatchObject({ id: grade.id, read: true });
    expect(await service.unreadCount(recipient.id)).toBe(1);
    expect(await service.markAllRead(recipient.id)).toEqual([]);
    expect(await service.unreadCount(recipient.id)).toBe(0);
    expect(await service.unreadCount(otherUser.id)).toBe(1);
  });

  it('conserva referencias antiguas existentes al modificar el estado de lectura', async () => {
    if (missingLegacyColumns) return;
    const notification = await service.dispatchGradePublished(recipient, 'Actividad', 4);
    await source.query(
      'UPDATE notifications SET "conversationId" = 12, "forumThreadId" = 13, "classId" = 14 WHERE id = ?',
      [notification.id],
    );
    await service.markRead(recipient.id, notification.id);
    const [stored] = await source.query(
      'SELECT "conversationId", "forumThreadId", "classId" FROM notifications WHERE id = ?',
      [notification.id],
    );
    expect(stored).toEqual({ conversationId: 12, forumThreadId: 13, classId: 14 });
  });
});
