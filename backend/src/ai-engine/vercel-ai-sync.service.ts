import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type VercelAiSyncResult = {
  status: 'not_configured' | 'env_update_failed' | 'redeploy_failed' | 'redeploy_requested';
  message: string;
};

@Injectable()
export class VercelAiSyncService {
  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return this.configuration() !== null;
  }

  private configuration() {
    if (this.config.get<string>('VERCEL_AI_SYNC_ENABLED') !== 'true' || this.config.get<string>('VERCEL_ENV') === 'preview') return null;
    const token = this.config.get<string>('VERCEL_API_TOKEN')?.trim();
    const projectId = this.config.get<string>('VERCEL_AI_PROJECT_ID')?.trim();
    const teamId = this.config.get<string>('VERCEL_AI_TEAM_ID')?.trim();
    const hook = this.config.get<string>('VERCEL_AI_DEPLOY_HOOK_URL')?.trim();
    if (!token || !/^[\x21-\x7e]+$/.test(token) || !projectId || !/^prj_[a-zA-Z0-9]+$/.test(projectId) || !hook) return null;
    try {
      const url = new URL(hook);
      const prefix = `/v1/integrations/deploy/${projectId}/`;
      if (url.protocol !== 'https:' || url.hostname !== 'api.vercel.com' || url.port || url.username || url.password || url.hash || !url.pathname.startsWith(prefix) || !/^[a-zA-Z0-9_-]+$/.test(url.pathname.slice(prefix.length))) return null;
      url.searchParams.set('buildCache', 'false');
      return { token, projectId, teamId, hookUrl: url.toString() };
    } catch {
      return null;
    }
  }

  async synchronize(apiKey: string): Promise<VercelAiSyncResult> {
    const config = this.configuration();
    if (!config) return {
      status: 'not_configured',
      message: 'La clave está guardada en la aplicación. La sincronización automática con Vercel necesita configurarse en el servidor.',
    };
    const envUrl = new URL(`https://api.vercel.com/v10/projects/${config.projectId}/env`);
    envUrl.searchParams.set('upsert', 'true');
    if (config.teamId) envUrl.searchParams.set('teamId', config.teamId);
    try {
      const result = await this.post(envUrl.toString(), {
        headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'AI_API_KEY', value: apiKey, type: 'encrypted', target: ['production'] }),
      }) as { created?: { id?: string }; failed?: unknown[] };
      if (!result.created?.id || !Array.isArray(result.failed) || result.failed.length) throw new Error();
    } catch {
      // Vercel puede incluir el valor enviado en sus errores: nunca devolver ni registrar ese cuerpo.
      return { status: 'env_update_failed', message: 'La clave está guardada en la aplicación, pero no se pudo confirmar la actualización de AI_API_KEY en Vercel. Revisa los permisos de la integración y reintenta la sincronización.' };
    }
    try {
      const result = await this.post(config.hookUrl, {}) as { job?: { id?: string; state?: string } };
      if (!result.job?.id || !result.job.state || ['ERROR', 'CANCELED'].includes(result.job.state)) throw new Error();
      return { status: 'redeploy_requested', message: 'API key actualizada en Vercel. Se solicitó automáticamente un nuevo despliegue del backend; la aplicación ya usa la nueva clave.' };
    } catch {
      return { status: 'redeploy_failed', message: 'AI_API_KEY se actualizó en Vercel, pero no se pudo confirmar la solicitud del nuevo despliegue. La aplicación ya usa la nueva clave; reintenta la sincronización.' };
    }
  }

  private async post(url: string, options: Pick<RequestInit, 'headers' | 'body'>) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(url, { ...options, method: 'POST', redirect: 'error', signal: controller.signal });
      if (!response.ok) throw new Error();
      return await response.json() as unknown;
    } finally {
      clearTimeout(timeout);
    }
  }
}
