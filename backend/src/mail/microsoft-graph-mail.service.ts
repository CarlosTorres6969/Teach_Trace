import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type GraphTokenResponse = {
  access_token?: string;
};

@Injectable()
export class MicrosoftGraphMailService {
  private readonly logger = new Logger(MicrosoftGraphMailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
    const enabled = this.config.get<string>('MAIL_ENABLED', 'false') === 'true';

    if (!enabled) {
      if (this.config.get<string>('NODE_ENV', 'development') !== 'production') {
        this.logger.warn(`MAIL_ENABLED=false. Enlace de recuperación para ${email}: ${resetUrl}`);
      }
      return;
    }

    const tenantId = this.config.get<string>('MICROSOFT_TENANT_ID');
    const clientId = this.config.get<string>('MICROSOFT_CLIENT_ID');
    const clientSecret = this.config.get<string>('MICROSOFT_CLIENT_SECRET');
    const senderEmail = this.config.get<string>('MICROSOFT_SENDER_EMAIL');

    if (!tenantId || !clientId || !clientSecret || !senderEmail) {
      throw new Error('Falta configurar Microsoft Graph para el envío de correo');
    }

    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials',
        }),
      },
    );

    if (!tokenResponse.ok) {
      throw new Error(`Microsoft Graph no entregó un token (${tokenResponse.status})`);
    }

    const token = (await tokenResponse.json()) as GraphTokenResponse;
    if (!token.access_token) {
      throw new Error('Microsoft Graph respondió sin access token');
    }

    const graphResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderEmail)}/sendMail`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            subject: 'Recuperación de contraseña de TeachTrace',
            body: {
              contentType: 'HTML',
              content: [
                '<p>Recibimos una solicitud para cambiar la contraseña de tu cuenta de TeachTrace.</p>',
                `<p><a href="${this.escapeHtml(resetUrl)}">Cambiar mi contraseña</a></p>`,
                '<p>Este enlace vence en 30 minutos y solo puede utilizarse una vez. Si no solicitaste este cambio, puedes ignorar este mensaje.</p>',
              ].join(''),
            },
            toRecipients: [{ emailAddress: { address: email } }],
          },
          saveToSentItems: false,
        }),
      },
    );

    if (!graphResponse.ok) {
      throw new Error(`Microsoft Graph no pudo enviar el correo (${graphResponse.status})`);
    }
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
