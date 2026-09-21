import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendTemporaryPasswordEmail(
    email: string,
    studentName: string,
    temporaryPassword: string,
    academicClass: {
      name: string;
      subject: string;
      code: string;
      period: string;
    },
  ): Promise<boolean> {
    const loginUrl = `${this.publicAppUrl()}/login`;
    const result = await this.sendEmail({
      to: email,
      subject: `Matrícula en ${academicClass.name} · TeachTrace`,
      text: [
        `Hola ${studentName},`,
        'Se creó tu cuenta de estudiante en TeachTrace.',
        `Fuiste matriculado en: ${academicClass.name}`,
        `Asignatura: ${academicClass.subject}`,
        `Código: ${academicClass.code}`,
        `Período: ${academicClass.period}`,
        `Correo: ${email}`,
        `Contraseña temporal: ${temporaryPassword}`,
        `Inicia sesión en: ${loginUrl}`,
        'Por seguridad, el sistema te pedirá cambiar esta contraseña antes de continuar.',
      ].join('\n\n'),
      html: [
        `<p>Hola ${this.escapeHtml(studentName)},</p>`,
        '<p>Se creó tu cuenta de estudiante en TeachTrace.</p>',
        '<p>Fuiste matriculado en la siguiente clase:</p>',
        `<p><strong>Clase:</strong> ${this.escapeHtml(academicClass.name)}<br>`,
        `<strong>Asignatura:</strong> ${this.escapeHtml(academicClass.subject)}<br>`,
        `<strong>Código:</strong> ${this.escapeHtml(academicClass.code)}<br>`,
        `<strong>Período:</strong> ${this.escapeHtml(academicClass.period)}</p>`,
        `<p><strong>Correo:</strong> ${this.escapeHtml(email)}<br>`,
        `<strong>Contraseña temporal:</strong> <code>${this.escapeHtml(temporaryPassword)}</code></p>`,
        `<p><a href="${this.escapeHtml(loginUrl)}">Iniciar sesión</a></p>`,
        '<p>Por seguridad, el sistema te pedirá cambiar esta contraseña antes de continuar.</p>',
      ].join(''),
    });
    if (!result) return false;
    this.logger.log('SMTP aceptó el correo de nueva cuenta para su entrega');
    return true;
  }

  async sendEnrollmentEmail(
    email: string,
    studentName: string,
    academicClass: {
      name: string;
      subject: string;
      code: string;
      period: string;
    },
  ): Promise<boolean> {
    const loginUrl = `${this.publicAppUrl()}/login`;
    const result = await this.sendEmail({
      to: email,
      subject: `Matrícula en ${academicClass.name} · TeachTrace`,
      text: [
        `Hola ${studentName},`,
        'Tu cuenta de TeachTrace fue matriculada en una clase.',
        `Clase: ${academicClass.name}`,
        `Asignatura: ${academicClass.subject}`,
        `Código: ${academicClass.code}`,
        `Período: ${academicClass.period}`,
        `Consulta tus actividades en: ${loginUrl}`,
        'Este correo es informativo. Tu contraseña actual no fue modificada.',
      ].join('\n\n'),
      html: [
        `<p>Hola ${this.escapeHtml(studentName)},</p>`,
        '<p>Tu cuenta de TeachTrace fue matriculada en la siguiente clase:</p>',
        `<p><strong>Clase:</strong> ${this.escapeHtml(academicClass.name)}<br>`,
        `<strong>Asignatura:</strong> ${this.escapeHtml(academicClass.subject)}<br>`,
        `<strong>Código:</strong> ${this.escapeHtml(academicClass.code)}<br>`,
        `<strong>Período:</strong> ${this.escapeHtml(academicClass.period)}</p>`,
        `<p><a href="${this.escapeHtml(loginUrl)}">Consultar mis actividades</a></p>`,
        '<p>Este correo es informativo. Tu contraseña actual no fue modificada.</p>',
      ].join(''),
    });
    if (!result) return false;
    this.logger.log('SMTP aceptó el correo de matrícula para su entrega');
    return true;
  }

  async sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
    const result = await this.sendEmail({
      to: email,
      subject: 'Recuperación de contraseña de TeachTrace',
      text: [
        'Recibimos una solicitud para cambiar la contraseña de tu cuenta de TeachTrace.',
        `Cambia tu contraseña desde este enlace: ${resetUrl}`,
        'Este enlace vence en 30 minutos y solo puede utilizarse una vez.',
      ].join('\n\n'),
      html: [
        '<p>Recibimos una solicitud para cambiar la contraseña de tu cuenta de TeachTrace.</p>',
        `<p><a href="${this.escapeHtml(resetUrl)}">Cambiar mi contraseña</a></p>`,
        '<p>Este enlace vence en 30 minutos y solo puede utilizarse una vez. Si no solicitaste este cambio, puedes ignorar este mensaje.</p>',
      ].join(''),
    });
    if (!result) {
      if (this.config.get<string>('NODE_ENV', 'development') !== 'production') {
        this.logger.warn(`MAIL_ENABLED=false. Enlace de recuperación para ${email}: ${resetUrl}`);
      }
      return;
    }
    this.logger.log('SMTP aceptó el correo de recuperación para su entrega');
  }

  async sendGradePublishedEmail(
    email: string,
    studentName: string,
    activityTitle: string,
    activityId: number,
  ): Promise<boolean> {
    const url = `${this.publicAppUrl()}/student/activities/${activityId}/results`;
    return Boolean(await this.sendEmail({
      to: email,
      subject: `Calificacion publicada - ${activityTitle}`,
      text: [
        `Hola ${studentName},`,
        `El docente publico la calificacion de tu entrega en "${activityTitle}".`,
        `Consulta tus resultados en: ${url}`,
      ].join('\n\n'),
      html: [
        `<p>Hola ${this.escapeHtml(studentName)},</p>`,
        `<p>El docente publico la calificacion de tu entrega en <strong>${this.escapeHtml(activityTitle)}</strong>.</p>`,
        `<p><a href="${this.escapeHtml(url)}">Consultar resultados</a></p>`,
      ].join(''),
    }));
  }

  async sendAiAnalysisEmail(
    email: string,
    teacherName: string,
    studentName: string,
    activityTitle: string,
    activityId: number,
    possibleGrade: number | null,
    discrepancy: boolean,
  ): Promise<boolean> {
    const url = `${this.publicAppUrl()}/teacher/activities/${activityId}/submissions`;
    const grade = possibleGrade === null ? 'pendiente' : `${possibleGrade}/100`;
    const discrepancyText = discrepancy
      ? ' Se detecto una diferencia entre el nivel declarado y el nivel estimado por la IA.'
      : '';
    return Boolean(await this.sendEmail({
      to: email,
      subject: `Analisis IA listo - ${activityTitle}`,
      text: [
        `Hola ${teacherName},`,
        `La entrega de ${studentName} para "${activityTitle}" ya fue analizada por el motor IA.`,
        `Nota sugerida: ${grade}.${discrepancyText}`,
        `Revisa y confirma la evaluacion en: ${url}`,
      ].join('\n\n'),
      html: [
        `<p>Hola ${this.escapeHtml(teacherName)},</p>`,
        `<p>La entrega de <strong>${this.escapeHtml(studentName)}</strong> para <strong>${this.escapeHtml(activityTitle)}</strong> ya fue analizada por el motor IA.</p>`,
        `<p><strong>Nota sugerida:</strong> ${this.escapeHtml(grade)}${this.escapeHtml(discrepancyText)}</p>`,
        `<p><a href="${this.escapeHtml(url)}">Revisar evaluacion</a></p>`,
      ].join(''),
    }));
  }

  private async sendEmail(input: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<nodemailer.SentMessageInfo | null> {
    if (this.config.get<string>('MAIL_ENABLED', 'false') !== 'true') {
      this.logger.warn(`MAIL_ENABLED=false. Correo no enviado a ${input.to}.`);
      return null;
    }

    const host = this.config.get<string>('SMTP_HOST', 'smtp.gmail.com');
    const port = Number(this.config.get<string>('SMTP_PORT', '465'));
    const user = this.config.get<string>('SMTP_USER');
    const password = this.config.get<string>('SMTP_PASS');
    if (!user || !password) {
      throw new Error('Falta configurar SMTP_USER y SMTP_PASS para enviar correos');
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      dnsTimeout: 10000,
      auth: { user, pass: password },
    });
    const result = await transporter.sendMail({
      from: `TeachTrace <${user}>`,
      ...input,
    });
    if (!result.accepted.length) throw new Error('SMTP no aceptó el destinatario');
    return result;
  }

  private publicAppUrl(): string {
    return this.config.get<string>('PUBLIC_APP_URL', 'http://localhost:5173').replace(/\/$/, '');
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    })[character] ?? character);
  }
}
