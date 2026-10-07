import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const API_KEY_FORMAT_MESSAGE = 'Escribe una API key de entre 20 y 4096 caracteres, sin espacios ni saltos de línea.';

export function normalizeAiApiKey(value: string): string {
  if (typeof value !== 'string' || !/^[\x21-\x7e]{20,4096}$/.test(value.trim())) {
    throw new BadRequestException(API_KEY_FORMAT_MESSAGE);
  }
  return value.trim();
}

@Injectable()
export class AiApiKeyValidatorService {
  constructor(private readonly config: ConfigService) {}

  async validate(value: string): Promise<string> {
    const apiKey = normalizeAiApiKey(value);
    let url: URL;
    try {
      url = new URL(this.config.get<string>('AI_API_URL')?.trim() ?? '');
    } catch {
      throw new ServiceUnavailableException('No se pudo verificar la API key. Revisa la configuración del servicio.');
    }
    // Esta comprobación usa un endpoint autenticado, sin generar contenido.
    // Otros proveedores requieren su propio validador: un /models público no prueba una clave.
    if (url.origin !== 'https://generativelanguage.googleapis.com' ||
        !/^\/v1beta\/openai\/chat\/completions\/?$/.test(url.pathname) ||
        url.username || url.password || url.search || url.hash) {
      throw new ServiceUnavailableException('No se pudo verificar la API key con el proveedor configurado. Revisa la configuración del servicio.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      let response: Response;
      try {
        response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', {
          method: 'GET',
          headers: { 'x-goog-api-key': apiKey, Accept: 'application/json' },
          redirect: 'error',
          signal: controller.signal,
        });
      } catch {
        throw new ServiceUnavailableException('No se pudo conectar con el proveedor para verificar la API key. Inténtalo de nuevo.');
      }
      if ([400, 401].includes(response.status)) {
        throw new BadRequestException('La API key no es válida o fue revocada. Revisa la clave e inténtalo de nuevo.');
      }
      if (response.status === 403) {
        throw new BadRequestException('La API key no tiene permiso para usar el motor de IA. Revisa sus permisos y restricciones.');
      }
      if (response.status === 429) {
        throw new ServiceUnavailableException('El proveedor alcanzó su límite de solicitudes. No se cambió la clave; inténtalo más tarde.');
      }
      if (!response.ok) {
        throw new ServiceUnavailableException('El proveedor no pudo verificar la API key. No se cambió la clave; inténtalo de nuevo.');
      }
      const body: unknown = await response.json().catch(() => null);
      if (!body || typeof body !== 'object' || !('models' in body) || !Array.isArray(body.models) ||
          !body.models.some((model: unknown) => model && typeof model === 'object' && 'name' in model && typeof model.name === 'string' && model.name.startsWith('models/'))) {
        throw new ServiceUnavailableException('El proveedor no pudo confirmar la API key. No se cambió la clave; inténtalo de nuevo.');
      }
      return apiKey;
    } finally {
      clearTimeout(timeout);
    }
  }
}
