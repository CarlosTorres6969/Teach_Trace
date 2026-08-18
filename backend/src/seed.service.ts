import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from './auth/auth.service';
import { Activity } from './entities/activity.entity';
import { AiDeclaration } from './entities/ai-declaration.entity';
import { Logbook } from './entities/logbook.entity';
import { Rubric } from './entities/rubric.entity';
import { Submission, SubmissionStatus } from './entities/submission.entity';
import { User, UserRole } from './entities/user.entity';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Activity) private readonly activities: Repository<Activity>,
    @InjectRepository(Rubric) private readonly rubrics: Repository<Rubric>,
    @InjectRepository(Logbook) private readonly logbooks: Repository<Logbook>,
    @InjectRepository(Submission) private readonly submissions: Repository<Submission>,
    @InjectRepository(AiDeclaration) private readonly declarations: Repository<AiDeclaration>,
    private readonly authService: AuthService,
  ) {}

  async onApplicationBootstrap() {
    if ((process.env.DEMO_SEED ?? 'true') !== 'true') return;
    const student = await this.ensureUser(
      'estudiante@unah.edu.hn',
      'Estudiante de prueba',
      'Estudiante123!',
      UserRole.STUDENT,
    );
    const teacher = await this.ensureUser(
      'docente@unah.edu.hn',
      'Docente de prueba',
      'Docente123!',
      UserRole.TEACHER,
    );

    let activity = await this.activities.findOne({ where: { title: 'Ensayo sobre ética e IA' } });
    if (!activity) {
      activity = await this.activities.save(
        this.activities.create({
          title: 'Ensayo sobre ética e IA',
          subject: 'Innovación Educativa',
          dueDate: '2026-09-15',
          activityType: 'Ensayo',
          learningOutcomes: ['Argumenta decisiones éticas sobre el uso académico de IA.'],
          teacher,
          rubric: null,
        }),
      );
    }

    let rubric = await this.rubrics.findOne({ where: { name: 'Rúbrica de ensayo argumentativo' } });
    if (!rubric) {
      rubric = await this.rubrics.save(
        this.rubrics.create({
          name: 'Rúbrica de ensayo argumentativo',
          teacher,
          activity,
          criteria: [
            {
              name: 'Calidad de la argumentación',
              dimension: 'Pensamiento crítico',
              descriptors: {
                level1: 'Presenta afirmaciones sin respaldo.',
                level2: 'Incluye argumentos básicos con respaldo limitado.',
                level3: 'Desarrolla argumentos claros y sustentados.',
                level4: 'Integra argumentos sólidos, evidencia y contraargumentos.',
              },
            },
          ],
        }),
      );
    }

    const existingLogbook = await this.logbooks.findOne({
      where: { student: { id: student.id }, activity: { id: activity.id } },
    });
    if (!existingLogbook) {
      await this.logbooks.save(
        this.logbooks.create({
          student,
          activity,
          initialIdeas: 'Analizaré beneficios, riesgos y responsabilidades del uso académico de IA.',
          prompts: '',
          validationsAndDecisions: '',
          finalReflection: '',
        }),
      );
    }

    const existingSubmission = await this.submissions.findOne({
      where: { student: { id: student.id }, activity: { id: activity.id } },
    });
    if (!existingSubmission) {
      await this.submissions.save(
        this.submissions.create({
          student,
          activity,
          status: SubmissionStatus.SUBMITTED,
          submittedAt: new Date(),
          productText: 'Borrador de demostración del ensayo sobre ética e inteligencia artificial.',
          productUrl: '',
        }),
      );
    }

    const existingDeclaration = await this.declarations.findOne({
      where: { student: { id: student.id }, activity: { id: activity.id } },
    });
    if (!existingDeclaration) {
      await this.declarations.save(
        this.declarations.create({
          student,
          activity,
          toolName: 'ChatGPT',
          usageLevel: 2,
          purpose: 'Organizar ideas y contrastar perspectivas.',
          promptSummary: 'Consultas sobre argumentos éticos y posibles contraargumentos.',
        }),
      );
    }
  }

  private async ensureUser(email: string, name: string, password: string, role: UserRole) {
    let user = await this.users.findOne({ where: { email } });
    if (!user) {
      user = await this.users.save(
        this.users.create({
          email,
          name,
          role,
          active: true,
          passwordHash: await this.authService.hashPassword(password),
        }),
      );
    }
    return user;
  }
}
