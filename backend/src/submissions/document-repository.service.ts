import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { isAbsolute, join, normalize, resolve } from 'path';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';

export type DocumentToStore = {
  name: string;
  mimeType: string;
  content: Buffer;
};

@Injectable()
export class DocumentRepositoryService {
  private readonly root: string;
  private readonly container: ContainerClient | null;
  private containerReady: Promise<void> | null = null;

  constructor(config: ConfigService) {
    const configured = config.get<string>('DOCUMENT_REPOSITORY_PATH', 'document-repository');
    this.root = isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
    const connectionString = config.get<string>('AZURE_STORAGE_CONNECTION_STRING')?.trim();
    const containerName = config.get<string>('AZURE_STORAGE_CONTAINER', 'teachtrace-submissions')?.trim();
    this.container = connectionString && containerName
      ? BlobServiceClient.fromConnectionString(connectionString).getContainerClient(containerName)
      : null;
  }

  async save(document: DocumentToStore, scope: string) {
    const safeName = document.name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'evidencia.pdf';
    const key = join(scope, `${randomUUID()}-${safeName}`).replaceAll('\\', '/');
    if (this.container) {
      await this.ensureContainer();
      await this.container.getBlockBlobClient(key).uploadData(document.content, {
        blobHTTPHeaders: { blobContentType: document.mimeType },
      });
      return { key, size: document.content.length };
    }
    const target = this.safePath(key);
    await mkdir(join(target, '..'), { recursive: true });
    await writeFile(target, document.content);
    return { key, size: document.content.length };
  }

  async read(key: string) {
    try {
      if (this.container) {
        await this.ensureContainer();
        return await this.container.getBlobClient(key).downloadToBuffer();
      }
      return await readFile(this.safePath(key));
    } catch {
      throw new NotFoundException('No se encontró el archivo en el repositorio documental');
    }
  }

  private async ensureContainer() {
    if (!this.container) return;
    this.containerReady ??= this.container.createIfNotExists().then(() => undefined);
    await this.containerReady;
  }

  private safePath(key: string) {
    const target = normalize(join(this.root, key));
    if (target !== this.root && !target.startsWith(`${this.root}\\`)) {
      throw new BadRequestException('Referencia de archivo no válida');
    }
    return target;
  }
}
