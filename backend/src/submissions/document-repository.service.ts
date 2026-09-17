import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { isAbsolute, join, normalize, resolve } from 'path';

export type DocumentToStore = {
  name: string;
  mimeType: string;
  content: Buffer;
};

@Injectable()
export class DocumentRepositoryService {
  private readonly root: string;

  constructor(config: ConfigService) {
    const configured = config.get<string>('DOCUMENT_REPOSITORY_PATH', 'document-repository');
    this.root = isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
  }

  async save(document: DocumentToStore, scope: string) {
    const safeName = document.name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'evidencia.pdf';
    const key = join(scope, `${randomUUID()}-${safeName}`).replaceAll('\\', '/');
    const target = this.safePath(key);
    await mkdir(join(target, '..'), { recursive: true });
    await writeFile(target, document.content);
    return { key, size: document.content.length };
  }

  async read(key: string) {
    try {
      return await readFile(this.safePath(key));
    } catch {
      throw new NotFoundException('No se encontró el archivo en el repositorio documental');
    }
  }

  private safePath(key: string) {
    const target = normalize(join(this.root, key));
    if (target !== this.root && !target.startsWith(`${this.root}\\`)) {
      throw new BadRequestException('Referencia de archivo no válida');
    }
    return target;
  }
}
