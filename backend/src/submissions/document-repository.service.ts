import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { randomUUID } from 'crypto';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { isAbsolute, join, normalize, relative, resolve } from 'path';

export type DocumentToStore = {
  name: string;
  mimeType: string;
  content: Buffer;
};

type StorageProvider = 'azure' | 'filesystem';

@Injectable()
export class DocumentRepositoryService implements OnModuleInit {
  private readonly logger = new Logger(DocumentRepositoryService.name);
  private readonly root: string;
  private readonly provider: StorageProvider;
  private readonly azureContainer?: ContainerClient;

  constructor(config: ConfigService) {
    const configuredPath = config.get<string>('DOCUMENT_REPOSITORY_PATH', 'document-repository');
    this.root = isAbsolute(configuredPath)
      ? configuredPath
      : resolve(process.cwd(), configuredPath);

    const requestedProvider = config
      .get<string>('DOCUMENT_STORAGE_PROVIDER')
      ?.trim()
      .toLowerCase();
    if (requestedProvider && !['azure', 'filesystem'].includes(requestedProvider)) {
      throw new Error('DOCUMENT_STORAGE_PROVIDER debe ser "azure" o "filesystem"');
    }

    const connectionString = config.get<string>('AZURE_STORAGE_CONNECTION_STRING')?.trim();
    const containerName = config.get<string>('AZURE_STORAGE_CONTAINER')?.trim();
    const hasAzureConfiguration = Boolean(connectionString || containerName);
    this.provider = (requestedProvider ?? (hasAzureConfiguration ? 'azure' : 'filesystem')) as StorageProvider;

    if (this.provider === 'azure') {
      if (!connectionString || !containerName) {
        throw new Error(
          'Azure Blob Storage requiere AZURE_STORAGE_CONNECTION_STRING y AZURE_STORAGE_CONTAINER',
        );
      }
      if (!/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/.test(containerName)) {
        throw new Error('AZURE_STORAGE_CONTAINER no tiene un nombre válido');
      }
      this.azureContainer = BlobServiceClient.fromConnectionString(connectionString)
        .getContainerClient(containerName);
    }
  }

  async onModuleInit() {
    if (this.provider === 'azure') {
      try {
        // Azure crea contenedores privados por defecto; los archivos solo se sirven por la API.
        await this.azureContainer!.createIfNotExists();
        this.logger.log('Repositorio documental conectado a Azure Blob Storage');
      } catch (error) {
        this.logAzureError('No fue posible conectar el repositorio documental con Azure', error);
        throw new ServiceUnavailableException(
          'No fue posible conectar con el almacenamiento de documentos',
        );
      }
      return;
    }

    await mkdir(this.root, { recursive: true });
    this.logger.log('Repositorio documental local preparado');
  }

  async save(document: DocumentToStore, scope: string) {
    const key = this.createObjectKey(document.name, scope);
    if (this.provider === 'azure') {
      try {
        const blob = this.azureContainer!.getBlockBlobClient(key);
        await blob.uploadData(document.content, {
          blobHTTPHeaders: { blobContentType: document.mimeType },
        });
        return { key: `azure:${key}`, size: document.content.length };
      } catch (error) {
        this.logAzureError('No fue posible guardar un documento en Azure', error);
        throw new ServiceUnavailableException(
          'No fue posible guardar el archivo de la entrega',
        );
      }
    }

    const target = this.safePath(key);
    await mkdir(join(target, '..'), { recursive: true });
    await writeFile(target, document.content);
    return { key: `local:${key}`, size: document.content.length };
  }

  async read(storageKey: string) {
    const reference = this.parseStorageKey(storageKey);
    if (reference.provider === 'azure') {
      if (!this.azureContainer) {
        throw new ServiceUnavailableException(
          'Azure Blob Storage no está configurado para recuperar este archivo',
        );
      }
      try {
        return await this.azureContainer.getBlockBlobClient(reference.key).downloadToBuffer();
      } catch (error) {
        if (this.isAzureNotFound(error)) {
          throw new NotFoundException('No se encontró el archivo en Azure Blob Storage');
        }
        this.logAzureError('No fue posible recuperar un documento desde Azure', error);
        throw new ServiceUnavailableException(
          'No fue posible recuperar el archivo de la entrega',
        );
      }
    }

    try {
      return await readFile(this.safePath(reference.key));
    } catch {
      throw new NotFoundException('No se encontró el archivo en el repositorio documental');
    }
  }

  async delete(storageKey: string) {
    const reference = this.parseStorageKey(storageKey);
    if (reference.provider === 'azure') {
      if (!this.azureContainer) {
        throw new ServiceUnavailableException(
          'Azure Blob Storage no está configurado para eliminar este archivo',
        );
      }
      try {
        await this.azureContainer.getBlockBlobClient(reference.key).deleteIfExists();
        return;
      } catch (error) {
        this.logAzureError('No fue posible eliminar un documento anterior de Azure', error);
        throw new ServiceUnavailableException(
          'No fue posible eliminar el archivo anterior de la entrega',
        );
      }
    }

    try {
      await unlink(this.safePath(reference.key));
    } catch (error) {
      const code = this.errorCode(error);
      if (code !== 'ENOENT') throw error;
    }
  }

  private createObjectKey(name: string, scope: string) {
    const normalizedScope = scope.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
    if (
      !normalizedScope ||
      !/^[a-zA-Z0-9/_-]+$/.test(normalizedScope) ||
      normalizedScope.split('/').some((segment) => segment === '.' || segment === '..')
    ) {
      throw new BadRequestException('Ámbito de almacenamiento no válido');
    }
    const safeName = (name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'evidencia.pdf').slice(-180);
    return `${normalizedScope}/${randomUUID()}-${safeName}`;
  }

  private parseStorageKey(storageKey: string): { provider: StorageProvider; key: string } {
    const explicitAzure = storageKey.startsWith('azure:');
    const explicitLocal = storageKey.startsWith('local:');
    const key = explicitAzure || explicitLocal
      ? storageKey.slice(storageKey.indexOf(':') + 1)
      : storageKey;
    const normalizedKey = key.replaceAll('\\', '/');
    if (
      !normalizedKey ||
      normalizedKey.startsWith('/') ||
      !/^[a-zA-Z0-9/._-]+$/.test(normalizedKey) ||
      normalizedKey.split('/').some((segment) => segment === '.' || segment === '..')
    ) {
      throw new BadRequestException('Referencia de archivo no válida');
    }
    return {
      provider: explicitAzure ? 'azure' : 'filesystem',
      key: normalizedKey,
    };
  }

  private safePath(key: string) {
    const target = normalize(join(this.root, key));
    const pathFromRoot = relative(this.root, target);
    if (pathFromRoot.startsWith('..') || isAbsolute(pathFromRoot)) {
      throw new BadRequestException('Referencia de archivo no válida');
    }
    return target;
  }

  private isAzureNotFound(error: unknown) {
    const code = this.errorCode(error);
    const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
      ? Number((error as { statusCode?: unknown }).statusCode)
      : undefined;
    return statusCode === 404 || code === 'BlobNotFound' || code === 'ContainerNotFound';
  }

  private errorCode(error: unknown) {
    if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }

  private logAzureError(message: string, error: unknown) {
    const code = this.errorCode(error);
    this.logger.error(code ? `${message} (${code})` : message);
  }
}
