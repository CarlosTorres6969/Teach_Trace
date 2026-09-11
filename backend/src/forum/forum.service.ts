import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassesService } from '../classes/classes.service';
import { AcademicClass } from '../entities/class.entity';
import { ForumPost } from '../entities/forum-post.entity';
import { ForumThread } from '../entities/forum-thread.entity';
import { User, UserRole } from '../entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateForumPostDto, CreateForumThreadDto } from './forum.dto';

const THREADS_PER_PAGE = 20;

@Injectable()
export class ForumService {
  constructor(
    @InjectRepository(ForumThread)
    private readonly threads: Repository<ForumThread>,
    @InjectRepository(ForumPost)
    private readonly posts: Repository<ForumPost>,
    @InjectRepository(AcademicClass)
    private readonly classes: Repository<AcademicClass>,
    private readonly classesService: ClassesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async listThreads(user: User, classId: number, page = 1, query = '') {
    const academicClass = await this.assertClassAccess(user, classId);
    const safePage = Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1);
    const builder = this.threads
      .createQueryBuilder('thread')
      .leftJoinAndSelect('thread.author', 'author')
      .leftJoinAndSelect('thread.academicClass', 'academicClass')
      .where('academicClass.id = :classId', { classId });
    const normalizedQuery = query.trim().slice(0, 120);
    if (normalizedQuery) {
      builder.andWhere(
        '(LOWER(thread.title) LIKE :query OR LOWER(thread.description) LIKE :query)',
        { query: `%${normalizedQuery.toLowerCase()}%` },
      );
    }
    builder
      .orderBy('thread.pinned', 'DESC')
      .addOrderBy('thread.updatedAt', 'DESC')
      .skip((safePage - 1) * THREADS_PER_PAGE)
      .take(THREADS_PER_PAGE);
    const [threads, total] = await builder.getManyAndCount();
    const items = await Promise.all(
      threads.map(async (thread) => ({
        ...this.threadResponse(thread),
        postCount: await this.posts.count({ where: { thread: { id: thread.id } } }),
      })),
    );
    return {
      academicClass: this.classResponse(academicClass),
      items,
      page: safePage,
      pageSize: THREADS_PER_PAGE,
      total,
      totalPages: Math.max(1, Math.ceil(total / THREADS_PER_PAGE)),
    };
  }

  async getThread(user: User, threadId: number) {
    const thread = await this.accessibleThread(user, threadId);
    const posts = await this.posts.find({
      where: { thread: { id: threadId } },
      relations: { parentPost: true },
      order: { createdAt: 'ASC' },
    });
    return {
      ...this.threadResponse(thread),
      academicClass: this.classResponse(thread.academicClass),
      posts: posts.map((post) => this.postResponse(post)),
    };
  }

  async createThread(user: User, classId: number, input: CreateForumThreadDto) {
    const academicClass = await this.assertClassAccess(user, classId);
    const title = input.title.trim();
    const description = input.description.trim();
    if (!title || !description) {
      throw new BadRequestException('El título y la descripción son obligatorios');
    }
    const thread = await this.threads.save(
      this.threads.create({
        academicClass,
        author: user,
        title,
        description,
        pinned: false,
        resolved: false,
      }),
    );
    return this.getThread(user, thread.id);
  }

  async createPost(user: User, threadId: number, input: CreateForumPostDto) {
    const thread = await this.accessibleThread(user, threadId);
    const body = input.body.trim();
    if (!body) throw new BadRequestException('La respuesta no puede estar vacía');
    let parentPost: ForumPost | null = null;
    if (input.parentPostId) {
      parentPost = await this.posts.findOne({
        where: { id: input.parentPostId },
        relations: { parentPost: true },
      });
      if (!parentPost || parentPost.thread.id !== thread.id) {
        throw new BadRequestException('La respuesta citada no pertenece a este hilo');
      }
      if (parentPost.parentPost) {
        throw new BadRequestException('El foro admite un solo nivel de anidación');
      }
    }
    const post = await this.posts.save(
      this.posts.create({ thread, author: user, parentPost, body }),
    );
    thread.updatedAt = new Date();
    await this.threads.save(thread);
    if (thread.author.id !== user.id) {
      await this.notificationsService.dispatchForumReply(
        thread.author,
        user.name,
        thread.title,
        thread.id,
        thread.academicClass.id,
      );
    }
    return this.postResponse(post);
  }

  async setPinned(user: User, threadId: number, pinned: boolean) {
    const thread = await this.threadForTeacher(user, threadId);
    thread.pinned = pinned;
    return this.threadResponse(await this.threads.save(thread));
  }

  async setResolved(user: User, threadId: number, resolved: boolean) {
    const thread = await this.accessibleThread(user, threadId);
    const isTeacher =
      user.role === UserRole.TEACHER && thread.academicClass.teacher.id === user.id;
    if (!isTeacher && thread.author.id !== user.id) {
      throw new ForbiddenException('Solo el autor o el docente pueden cambiar este estado');
    }
    thread.resolved = resolved;
    return this.threadResponse(await this.threads.save(thread));
  }

  async deletePost(user: User, postId: number) {
    const post = await this.posts.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('La publicación no existe');
    await this.threadForTeacher(user, post.thread.id);
    await this.posts.remove(post);
    return { deleted: true, postId };
  }

  private async threadForTeacher(user: User, threadId: number) {
    if (user.role !== UserRole.TEACHER) {
      throw new ForbiddenException('Solo el docente puede realizar esta acción');
    }
    const thread = await this.threads.findOne({
      where: { id: threadId },
      relations: { academicClass: { teacher: true } },
    });
    if (!thread) throw new NotFoundException('El hilo no existe');
    await this.classesService.ownedClass(user.id, thread.academicClass.id);
    return thread;
  }

  private async accessibleThread(user: User, threadId: number) {
    const thread = await this.threads.findOne({
      where: { id: threadId },
      relations: { academicClass: { teacher: true } },
    });
    if (!thread) throw new NotFoundException('El hilo no existe');
    await this.assertClassAccess(user, thread.academicClass.id);
    return thread;
  }

  private async assertClassAccess(user: User, classId: number) {
    const academicClass = await this.classes.findOne({ where: { id: classId } });
    if (!academicClass) throw new NotFoundException('La clase no existe');
    if (user.role === UserRole.TEACHER) {
      await this.classesService.ownedClass(user.id, classId);
    } else if (!(await this.classesService.isStudentEnrolled(user.id, classId))) {
      throw new NotFoundException('La clase no existe o no está asignada al estudiante');
    }
    return academicClass;
  }

  private threadResponse(thread: ForumThread) {
    return {
      id: thread.id,
      title: thread.title,
      description: thread.description,
      pinned: thread.pinned,
      resolved: thread.resolved,
      author: {
        id: thread.author.id,
        name: thread.author.name,
        role: thread.author.role,
      },
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    };
  }

  private postResponse(post: ForumPost) {
    return {
      id: post.id,
      body: post.body,
      parentPostId: post.parentPost?.id ?? null,
      author: { id: post.author.id, name: post.author.name, role: post.author.role },
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }

  private classResponse(academicClass: AcademicClass) {
    return {
      id: academicClass.id,
      name: academicClass.name,
      code: academicClass.code,
      subject: academicClass.subject,
    };
  }
}
