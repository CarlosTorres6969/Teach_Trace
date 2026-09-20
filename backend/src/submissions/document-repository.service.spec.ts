import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { BlobServiceClient } from '@azure/storage-blob';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { DocumentRepositoryService } from './document-repository.service';

function config(values: Record<string, string | undefined>) {
  return {
    get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback),
  } as unknown as ConfigService;
}

describe('DocumentRepositoryService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('crea el contenedor privado y guarda, recupera y elimina archivos en Azure', async () => {
    const uploadData = jest.fn().mockResolvedValue({});
    const downloadToBuffer = jest.fn().mockResolvedValue(Buffer.from('contenido'));
    const deleteIfExists = jest.fn().mockResolvedValue({ succeeded: true });
    const getBlockBlobClient = jest.fn().mockReturnValue({
      uploadData,
      downloadToBuffer,
      deleteIfExists,
    });
    const createIfNotExists = jest.fn().mockResolvedValue({ succeeded: true });
    const getContainerClient = jest.fn().mockReturnValue({
      createIfNotExists,
      getBlockBlobClient,
    });
    jest.spyOn(BlobServiceClient, 'fromConnectionString').mockReturnValue({
      getContainerClient,
    } as never);

    const repository = new DocumentRepositoryService(config({
      DOCUMENT_STORAGE_PROVIDER: 'azure',
      AZURE_STORAGE_CONNECTION_STRING: 'UseDevelopmentStorage=true',
      AZURE_STORAGE_CONTAINER: 'teachtrace-submissions',
    }));

    await repository.onModuleInit();
    const stored = await repository.save({
      name: 'evidencia final.pdf',
      mimeType: 'application/pdf',
      content: Buffer.from('contenido'),
    }, 'submissions/2/4');
    const content = await repository.read(stored.key);
    await repository.delete(stored.key);

    expect(createIfNotExists).toHaveBeenCalledWith();
    expect(getContainerClient).toHaveBeenCalledWith('teachtrace-submissions');
    expect(stored.key).toMatch(/^azure:submissions\/2\/4\/.+-evidencia_final\.pdf$/);
    expect(uploadData).toHaveBeenCalledWith(
      Buffer.from('contenido'),
      { blobHTTPHeaders: { blobContentType: 'application/pdf' } },
    );
    expect(content.toString()).toBe('contenido');
    expect(deleteIfExists).toHaveBeenCalledTimes(1);
  });

  it('mantiene acceso a referencias locales nuevas y anteriores', async () => {
    const root = await mkdtemp(join(tmpdir(), 'teachtrace-documents-'));
    try {
      const repository = new DocumentRepositoryService(config({
        DOCUMENT_STORAGE_PROVIDER: 'filesystem',
        DOCUMENT_REPOSITORY_PATH: root,
      }));
      await repository.onModuleInit();

      const stored = await repository.save({
        name: 'entrega.pdf',
        mimeType: 'application/pdf',
        content: Buffer.from('%PDF-contenido'),
      }, 'submissions/3/8');

      expect(stored.key).toMatch(/^local:submissions\/3\/8\//);
      await expect(repository.read(stored.key)).resolves.toEqual(Buffer.from('%PDF-contenido'));
      await expect(repository.read(stored.key.replace(/^local:/, '')))
        .resolves.toEqual(Buffer.from('%PDF-contenido'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rechaza configuraciones incompletas de Azure', () => {
    expect(() => new DocumentRepositoryService(config({
      AZURE_STORAGE_CONNECTION_STRING: 'UseDevelopmentStorage=true',
    }))).toThrow('AZURE_STORAGE_CONNECTION_STRING y AZURE_STORAGE_CONTAINER');
  });

  it('diferencia un blob inexistente de un fallo general del proveedor', async () => {
    const downloadToBuffer = jest.fn().mockRejectedValue({
      statusCode: 404,
      code: 'BlobNotFound',
    });
    jest.spyOn(BlobServiceClient, 'fromConnectionString').mockReturnValue({
      getContainerClient: jest.fn().mockReturnValue({
        createIfNotExists: jest.fn().mockResolvedValue({}),
        getBlockBlobClient: jest.fn().mockReturnValue({ downloadToBuffer }),
      }),
    } as never);
    const repository = new DocumentRepositoryService(config({
      DOCUMENT_STORAGE_PROVIDER: 'azure',
      AZURE_STORAGE_CONNECTION_STRING: 'UseDevelopmentStorage=true',
      AZURE_STORAGE_CONTAINER: 'teachtrace-submissions',
    }));

    await expect(repository.read('azure:submissions/2/4/inexistente.pdf'))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});
