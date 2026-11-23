import { ConfigService } from '@nestjs/config';
import { NotFoundException, BadRequestException, PayloadTooLargeException } from '@nestjs/common';
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

  function directRepository() {
    const blob = {
      generateSasUrl: jest.fn().mockResolvedValue('https://storage.example/upload?signed'),
      getProperties: jest.fn().mockResolvedValue({
        contentLength: 10 * 1024 * 1024, contentType: 'application/pdf', etag: 'unchanged',
      }),
      downloadToBuffer: jest.fn().mockResolvedValue(Buffer.from('%PDF-')),
    };
    const getBlockBlobClient = jest.fn().mockReturnValue(blob);
    jest.spyOn(BlobServiceClient, 'fromConnectionString').mockReturnValue({
      getContainerClient: jest.fn().mockReturnValue({ getBlockBlobClient }),
    } as never);
    const repository = new DocumentRepositoryService(config({
      DOCUMENT_STORAGE_PROVIDER: 'azure',
      AZURE_STORAGE_CONNECTION_STRING: 'UseDevelopmentStorage=true',
      AZURE_STORAGE_CONTAINER: 'teachtrace-submissions',
    }));
    return { repository, blob, getBlockBlobClient };
  }

  it('autoriza un único blob por diez minutos sin lectura, borrado ni sobrescritura', async () => {
    const { repository, blob, getBlockBlobClient } = directRepository();
    const before = Date.now();
    const upload = await repository.prepareUpload('entrega.pdf', 'submissions/2/4');
    expect(upload?.key).toMatch(/^azure:submissions\/2\/4\/.+-entrega.pdf$/);
    expect(getBlockBlobClient).toHaveBeenCalledWith(upload!.key.slice(6));
    const options = blob.generateSasUrl.mock.calls[0][0];
    expect(options.permissions.toString()).toBe('c');
    expect(options.protocol).toBe('https');
    expect(options.expiresOn.getTime()).toBeGreaterThanOrEqual(before + 600_000);
    expect(options.expiresOn.getTime()).toBeLessThanOrEqual(Date.now() + 600_000);
  });

  it('valida un PDF de 10 MB descargando solo la firma y comprobando su versión', async () => {
    const { repository, blob } = directRepository();
    await expect(repository.verifyUpload('azure:submissions/2/4/archivo.pdf', 'submissions/2/4', 10 * 1024 * 1024))
      .resolves.toEqual({ key: 'azure:submissions/2/4/archivo.pdf', size: 10 * 1024 * 1024 });
    expect(blob.downloadToBuffer).toHaveBeenCalledWith(0, 5, { conditions: { ifMatch: 'unchanged' } });
  });

  it('autoriza la descarga privada por cinco minutos con permiso de solo lectura', async () => {
    const { repository, blob } = directRepository();
    const before = Date.now();
    await repository.downloadUrl('azure:submissions/2/4/archivo.pdf', 'Trabajo final.pdf');
    const options = blob.generateSasUrl.mock.calls[0][0];
    expect(options.permissions.toString()).toBe('r');
    expect(options.protocol).toBe('https');
    expect(options.expiresOn.getTime()).toBeGreaterThanOrEqual(before + 300_000);
    expect(options.expiresOn.getTime()).toBeLessThanOrEqual(Date.now() + 300_000);
    expect(options.contentDisposition).toContain('Trabajo%20final.pdf');
    expect(blob.downloadToBuffer).not.toHaveBeenCalled();
  });

  it('rechaza referencias de otro estudiante antes de consultar Azure', async () => {
    const { repository, blob } = directRepository();
    await expect(repository.verifyUpload('azure:submissions/3/4/archivo.pdf', 'submissions/2/4', 8))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(blob.getProperties).not.toHaveBeenCalled();
  });

  it('rechaza archivos superiores a 10 MB sin descargar su contenido', async () => {
    const { repository, blob } = directRepository();
    blob.getProperties.mockResolvedValue({ contentLength: 10 * 1024 * 1024 + 1, contentType: 'application/pdf', etag: 'v1' });
    await expect(repository.verifyUpload('azure:submissions/2/4/archivo.pdf', 'submissions/2/4', 8))
      .rejects.toBeInstanceOf(PayloadTooLargeException);
    expect(blob.downloadToBuffer).not.toHaveBeenCalled();
  });

  it.each(['size', 'mime', 'signature', 'missing'])('rechaza un PDF inválido: %s', async (invalid) => {
    const { repository, blob } = directRepository();
    blob.getProperties.mockResolvedValue({ contentLength: 8, contentType: 'application/pdf', etag: 'v1' });
    if (invalid === 'size') blob.getProperties.mockResolvedValue({ contentLength: 9, contentType: 'application/pdf', etag: 'v1' });
    if (invalid === 'mime') blob.getProperties.mockResolvedValue({ contentLength: 8, contentType: 'text/html', etag: 'v1' });
    if (invalid === 'signature') blob.downloadToBuffer.mockResolvedValue(Buffer.from('<html'));
    if (invalid === 'missing') blob.getProperties.mockRejectedValue({ statusCode: 404, code: 'BlobNotFound' });
    await expect(repository.verifyUpload('azure:submissions/2/4/archivo.pdf', 'submissions/2/4', 8))
      .rejects.toBeInstanceOf(BadRequestException);
  });

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
