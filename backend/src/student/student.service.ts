import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivitiesService } from '../activities/activities.service';
import { AiDeclarationsService } from '../ai-declarations/ai-declarations.service';
import { Submission, SubmissionStatus } from '../entities/submission.entity';
import { Valuation } from '../entities/valuation.entity';
import { User } from '../entities/user.entity';
import { LogbooksService } from '../logbooks/logbooks.service';
import { SubmissionsService, UploadedAcademicFile } from '../submissions/submissions.service';
import { SubmitEvidenceDto } from '../submissions/submit-evidence.dto';
import { UpdateLogbookDto } from '../logbooks/update-logbook.dto';
import { UpdateAiDeclarationDto } from '../ai-declarations/update-ai-declaration.dto';

@Injectable()
export class StudentService {
  constructor(
    private readonly activitiesService: ActivitiesService,
    private readonly logbooksService: LogbooksService,
    private readonly declarationsService: AiDeclarationsService,
    private readonly submissionsService: SubmissionsService,
    @InjectRepository(Submission)
    private readonly submissions: Repository<Submission>,
    @InjectRepository(Valuation)
    private readonly valuations: Repository<Valuation>,
  ) {}

  async listActivities(studentId: number) {
    const activities = await this.activitiesService.listForStudent(studentId);
    return Promise.all(
      activities.map(async (activity) => {
        const submission = await this.submissionsService.getStatus(studentId, activity.id);
        const finalScore = await this.getActivityFinalScore(studentId, activity.id);
        return {
          id: activity.id,
          title: activity.title,
          subject: activity.subject,
          dueDate: activity.dueDate,
          weight: activity.weight,
          evaluationPhase: activity.evaluationPhase,
          academicClass: activity.academicClass
            ? {
                id: activity.academicClass.id,
                name: activity.academicClass.name,
                code: activity.academicClass.code,
              }
            : null,
          submissionStatus: submission.status,
          finalScore,
        };
      }),
    );
  }

  getLogbook(studentId: number, activityId: number) {
    return this.logbooksService.getForStudent(studentId, activityId);
  }

  updateLogbook(student: User, activityId: number, input: UpdateLogbookDto) {
    return this.logbooksService.update(student, activityId, input);
  }

  getSubmissionStatus(studentId: number, activityId: number) {
    return this.submissionsService.getStatus(studentId, activityId);
  }

  getAiDeclaration(studentId: number, activityId: number) {
    return this.declarationsService.getForStudent(studentId, activityId);
  }

  updateAiDeclaration(student: User, activityId: number, input: UpdateAiDeclarationDto) {
    return this.declarationsService.update(student, activityId, input);
  }

  submitEvidence(
    student: User,
    activityId: number,
    input: SubmitEvidenceDto,
    file?: UploadedAcademicFile,
  ) {
    return this.submissionsService.submit(student, activityId, input, file);
  }

  // ─── Helpers privados ────────────────────────────────────────────────────────

  private async getActivityFinalScore(studentId: number, activityId: number): Promise<number | null> {
    const submission = await this.submissions.findOne({
      where: { student: { id: studentId }, activity: { id: activityId } },
    });
    if (!submission) return null;
    const valuationList = await this.valuations.find({
      where: { submission: { id: submission.id } },
    });
    const teacherValues = valuationList
      .filter((v) => v.teacherValue !== null)
      .map((v) => v.teacherValue as number);
    if (!teacherValues.length) return null;
    return teacherValues.reduce((a, b) => a + b, 0) / teacherValues.length;
  }

  // ─── Proyección ───────────────────────────────────────────────────────────────

  async getProjection(studentId: number, classId: number) {
    const activities = await this.activitiesService.listForStudent(studentId);
    // Filtrar solo las de esta clase
    const classActivities = activities.filter(
      (a) => a.academicClass?.id === classId,
    );
    if (!classActivities.length) {
      return {
        classId,
        totalActivities: 0,
        completedActivities: 0,
        pendingActivities: 0,
        currentWeightedScore: null,
        projectedFinalScore: null,
        projectedPercentage: null,
        requiredAvgToPass: null,
        passingThreshold: 2.6,
        activities: [],
      };
    }

    // Escala 1-4 → porcentaje: (score - 1) / 3 * 100
    const toPercent = (score: number) => Math.round(((score - 1) / 3) * 100);

    type ActivityProjection = {
      id: number;
      title: string;
      dueDate: string;
      weight: number;
      status: string;
      finalScore: number | null;
      percentage: number | null;
    };

    const activityProjections: ActivityProjection[] = await Promise.all(
      classActivities.map(async (activity) => {
        const finalScore = await this.getActivityFinalScore(studentId, activity.id);
        const submission = await this.submissions.findOne({
          where: { student: { id: studentId }, activity: { id: activity.id } },
        });
        return {
          id: activity.id,
          title: activity.title,
          dueDate: activity.dueDate,
          weight: activity.weight ?? 1.0,
          status: submission?.status ?? 'not_submitted',
          finalScore,
          percentage: finalScore !== null ? toPercent(finalScore) : null,
        };
      }),
    );

    // Separar completadas (con teacherValue) de pendientes
    const completed = activityProjections.filter((a) => a.finalScore !== null);
    const pending = activityProjections.filter((a) => a.finalScore === null);

    // Nota ponderada actual: Σ(score × weight) / Σ(weight) para completadas
    const sumWeightedScores = completed.reduce((acc, a) => acc + (a.finalScore! * a.weight), 0);
    const sumCompletedWeights = completed.reduce((acc, a) => acc + a.weight, 0);
    const currentWeightedScore = sumCompletedWeights > 0
      ? sumWeightedScores / sumCompletedWeights
      : null;

    // Proyección: si mantengo el mismo promedio en las pendientes
    const totalWeight = activityProjections.reduce((acc, a) => acc + a.weight, 0);
    const sumPendingWeights = pending.reduce((acc, a) => acc + a.weight, 0);

    let projectedFinalScore: number | null = null;
    if (currentWeightedScore !== null) {
      const projectedPendingContribution = currentWeightedScore * sumPendingWeights;
      projectedFinalScore = (sumWeightedScores + projectedPendingContribution) / totalWeight;
    }

    const projectedPercentage = projectedFinalScore !== null
      ? toPercent(projectedFinalScore)
      : null;

    // ¿Cuánto necesito en las pendientes para llegar al 80 % (≈ nivel 3.4 en escala 1-4)?
    // 80 % en escala 1-4 = 1 + 0.80 * 3 = 3.4
    const passingThreshold = 3.4; // equivale a 80%
    let requiredAvgToPass: number | null = null;
    if (sumPendingWeights > 0) {
      // passingThreshold * totalWeight = sumWeightedScores + requiredAvg * sumPendingWeights
      const required = (passingThreshold * totalWeight - sumWeightedScores) / sumPendingWeights;
      requiredAvgToPass = Math.max(1, Math.min(4, required));
    }

    return {
      classId,
      totalActivities: classActivities.length,
      completedActivities: completed.length,
      pendingActivities: pending.length,
      currentWeightedScore,
      projectedFinalScore,
      projectedPercentage,
      requiredAvgToPass,
      passingThreshold,
      activities: activityProjections,
    };
  }

  // ─── Gráfico de evolución ─────────────────────────────────────────────────────

  async getPerformanceChart(studentId: number, classId?: number) {
    const toPercent = (score: number) => Math.round(((score - 1) / 3) * 100);

    // Obtener actividades del estudiante, opcionalmente filtradas por clase
    const allActivities = await this.activitiesService.listForStudent(studentId);
    const activities = classId
      ? allActivities.filter((a) => a.academicClass?.id === classId)
      : allActivities;

    // Ordenar cronológicamente por dueDate
    const sorted = [...activities].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    const labels: string[] = [];
    const myGrades: (number | null)[] = [];
    const classAverage: (number | null)[] = [];
    const activityMeta: Array<{ id: number; title: string; dueDate: string }> = [];

    for (const activity of sorted) {
      labels.push(activity.dueDate);
      activityMeta.push({ id: activity.id, title: activity.title, dueDate: activity.dueDate });

      // Nota propia
      const myScore = await this.getActivityFinalScore(studentId, activity.id);
      myGrades.push(myScore !== null ? toPercent(myScore) : null);

      // Promedio de la clase: solo estudiantes con entrega evaluada en esta actividad
      const allSubmissions = await this.submissions.find({
        where: { activity: { id: activity.id } },
      });

      const classScores: number[] = [];
      for (const sub of allSubmissions) {
        if (sub.student.id === studentId) continue; // excluir el propio
        const subValuations = await this.valuations.find({
          where: { submission: { id: sub.id } },
        });
        const teacherVals = subValuations
          .filter((v) => v.teacherValue !== null)
          .map((v) => v.teacherValue as number);
        if (teacherVals.length) {
          const avg = teacherVals.reduce((a, b) => a + b, 0) / teacherVals.length;
          classScores.push(toPercent(avg));
        }
      }
      // Incluir la nota propia en el promedio de la clase si existe
      if (myScore !== null) classScores.push(toPercent(myScore));

      classAverage.push(
        classScores.length > 0
          ? Math.round(classScores.reduce((a, b) => a + b, 0) / classScores.length)
          : null,
      );
    }

    // Regresión lineal simple sobre los puntos propios no nulos
    const trendLine = this.linearRegression(myGrades);

    return {
      labels,
      myGrades,
      classAverage,
      trendLine,
      activities: activityMeta,
    };
  }

  // Regresión lineal simple: devuelve un punto por cada label (null si no hay datos suficientes)
  private linearRegression(values: (number | null)[]): (number | null)[] {
    const points: Array<{ x: number; y: number }> = [];
    values.forEach((v, i) => { if (v !== null) points.push({ x: i, y: v }); });
    if (points.length < 2) return values.map(() => null);

    const n = points.length;
    const sumX = points.reduce((acc, p) => acc + p.x, 0);
    const sumY = points.reduce((acc, p) => acc + p.y, 0);
    const sumXY = points.reduce((acc, p) => acc + p.x * p.y, 0);
    const sumX2 = points.reduce((acc, p) => acc + p.x * p.x, 0);
    const denom = n * sumX2 - sumX * sumX;
    if (denom === 0) return values.map(() => null);

    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;

    return values.map((_, i) => {
      const val = slope * i + intercept;
      return Math.round(Math.max(0, Math.min(100, val)));
    });
  }

  async getResults(studentId: number, activityId: number) {
    const activity = await this.activitiesService.getForStudent(studentId, activityId);
    const submission = await this.submissions.findOne({
      where: { student: { id: studentId }, activity: { id: activityId } },
    });

    const isEvaluated = submission?.status === SubmissionStatus.EVALUATED;

    // Solo exponer valoraciones cuando la evaluación está completamente publicada
    const valuationList =
      isEvaluated && submission
        ? await this.valuations.find({ where: { submission: { id: submission.id } } })
        : [];

    const confirmedValues = valuationList
      .filter((v) => v.teacherValue !== null)
      .map((v) => v.teacherValue as number);

    const finalScore =
      confirmedValues.length > 0
        ? confirmedValues.reduce((a, b) => a + b, 0) / confirmedValues.length
        : null;

    return {
      activity: { id: activity.id, title: activity.title },
      status: submission?.status ?? SubmissionStatus.NOT_SUBMITTED,
      // Valoraciones vacías hasta que el docente publique la evaluación completa
      valuations: valuationList.map((v) => ({
        id: v.id,
        criterion: v.criterion,
        dimension: v.dimension,
        aiValue: v.aiValue,
        teacherValue: v.teacherValue,
        teacherComment: v.teacherComment,
        confirmed: v.confirmed,
      })),
      finalScore,
      feedback: '',
    };
  }
}
