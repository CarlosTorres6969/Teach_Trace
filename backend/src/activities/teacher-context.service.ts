import { BadRequestException, Injectable, PayloadTooLargeException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import mammoth = require('mammoth');
import JSZip = require('jszip');
import { Readable } from 'stream';
import pdfParse = require('pdf-parse');
import { ActivitiesService } from './activities.service';
import { PrepareTeacherContextUploadDto, SaveTeacherContextDto } from './activities.dto';
import { TeacherContextDocument } from '../entities/activity.entity';
import { DocumentRepositoryService } from '../submissions/document-repository.service';
import type { UploadedAcademicFile } from '../submissions/submissions.service';

const MAX_SIZE = 10 * 1024 * 1024;
const MAX_TEXT = 100_000;
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
type ContextReceipt = {
  purpose: string; teacherId: number; activityId: number;
  key: string; fileName: string; fileSize: number;
};

@Injectable()
export class TeacherContextService {
  constructor(
    private readonly activities: ActivitiesService,
    private readonly documents: DocumentRepositoryService,
    private readonly tokens: JwtService,
  ) {}

  private mimeType(name: string) {
    if (/\.pdf$/i.test(name)) return 'application/pdf';
    if (/\.docx$/i.test(name)) return DOCX_MIME;
    throw new BadRequestException('Selecciona un PDF o Word (.docx)');
  }

  private metadata(document: TeacherContextDocument | null) {
    return document ? { fileName: document.fileName, mimeType: document.mimeType, size: document.size } : null;
  }

  private async extractDocxText(content: Buffer) {
    const archive = await JSZip.loadAsync(content);
    const entries = Object.values(archive.files).filter((entry) => !entry.dir);
    if (!archive.file('word/document.xml') || entries.length > 2_000) throw new Error('Invalid DOCX');
    // Validate actual expanded bytes before Mammoth processes the archive.
    let expanded = 0;
    for (const entry of entries) {
      const stream = entry.nodeStream('nodebuffer') as Readable;
      try {
        await new Promise<void>((resolve, reject) => {
          stream.once('error', reject);
          stream.once('end', resolve);
          stream.on('data', (chunk: Buffer) => {
            expanded += chunk.length;
            if (expanded > 30 * 1024 * 1024) {
              stream.destroy();
              reject(new Error('Document expands beyond limit'));
            }
          });
        });
      } finally {
        stream.destroy();
      }
    }
    return (await mammoth.extractRawText({ buffer: content })).value;
  }

  async get(teacherId: number, activityId: number) {
    return { document: this.metadata(await this.activities.getTeacherContext(teacherId, activityId)) };
  }

  async prepareUpload(teacherId: number, activityId: number, input: PrepareTeacherContextUploadDto) {
    await this.activities.ownedActivity(teacherId, activityId);
    const mimeType = this.mimeType(input.fileName);
    const upload = await this.documents.prepareUpload(input.fileName, `teacher-context/${teacherId}/${activityId}`);
    if (!upload) return { mode: 'multipart' as const, mimeType };
    const uploadToken = await this.tokens.signAsync({
      purpose: 'teacher-context', teacherId, activityId, key: upload.key,
      fileName: input.fileName, fileSize: input.fileSize,
    }, { audience: 'teacher-context', expiresIn: '15m' });
    return { mode: 'direct' as const, mimeType, uploadUrl: upload.uploadUrl, uploadToken };
  }

  async save(teacherId: number, activityId: number, input: SaveTeacherContextDto, file?: UploadedAcademicFile) {
    await this.activities.ownedActivity(teacherId, activityId);
    if (Boolean(file) === Boolean(input.uploadToken)) {
      throw new BadRequestException('Adjunta un único documento de contexto');
    }
    let name: string;
    let mimeType: string;
    let content: Buffer;
    let storageKey: string | undefined;
    if (input.uploadToken) {
      let receipt: ContextReceipt;
      try {
        receipt = await this.tokens.verifyAsync<ContextReceipt>(input.uploadToken, { audience: 'teacher-context' });
        if (receipt.purpose !== 'teacher-context' || receipt.teacherId !== teacherId ||
          receipt.activityId !== activityId || typeof receipt.key !== 'string' ||
          typeof receipt.fileName !== 'string' || !Number.isInteger(receipt.fileSize) ||
          receipt.fileSize < 5 || receipt.fileSize > MAX_SIZE) throw new Error('Invalid receipt');
      } catch {
        throw new BadRequestException('La autorización del documento no es válida o venció; vuelve a seleccionarlo');
      }
      name = receipt.fileName;
      mimeType = this.mimeType(name);
      const verified = await this.documents.verifyDocumentUpload(
        receipt.key, `teacher-context/${teacherId}/${activityId}`, receipt.fileSize, mimeType,
      );
      storageKey = verified.key;
      content = await this.documents.read(storageKey);
    } else {
      name = file!.originalname;
      mimeType = this.mimeType(name);
      content = file!.buffer;
    }
    if (content.length > MAX_SIZE) throw new PayloadTooLargeException('El documento no puede superar 10 MB');
    const validSignature = mimeType === 'application/pdf'
      ? content.subarray(0, 5).toString('ascii') === '%PDF-'
      : content.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    if (!validSignature) throw new BadRequestException('El contenido del documento no corresponde con su formato');
    let text: string;
    try {
      text = mimeType === 'application/pdf'
        ? (await pdfParse(Uint8Array.from(content) as unknown as Buffer)).text
        : await this.extractDocxText(content);
      text = text.replace(/\u0000/g, '').trim();
    } catch {
      throw new BadRequestException('No fue posible leer el documento. Verifica que no esté dañado ni protegido con contraseña');
    }
    if (!text) throw new BadRequestException('El documento debe contener texto seleccionable para usarlo como contexto de IA');
    if (text.length > MAX_TEXT) throw new BadRequestException('El documento contiene demasiado texto; adjunta una definición más breve (máximo 100 000 caracteres)');
    if (!storageKey) {
      storageKey = (await this.documents.save({ name, mimeType, content }, `teacher-context/${teacherId}/${activityId}`)).key;
    }
    const document: TeacherContextDocument = { fileName: name, mimeType, size: content.length, storageKey, text };
    await this.activities.setTeacherContext(teacherId, activityId, document);
    return { document: this.metadata(document) };
  }

  async remove(teacherId: number, activityId: number) {
    await this.activities.ownedActivity(teacherId, activityId);
    await this.activities.setTeacherContext(teacherId, activityId, null);
    return { document: null };
  }

  async download(teacherId: number, activityId: number) {
    const document = await this.activities.getTeacherContext(teacherId, activityId);
    if (!document) throw new BadRequestException('La actividad no tiene un documento de contexto');
    const url = await this.documents.downloadUrl(document.storageKey, document.fileName);
    return { url };
  }

  async readFile(teacherId: number, activityId: number) {
    const document = await this.activities.getTeacherContext(teacherId, activityId);
    if (!document) throw new BadRequestException('La actividad no tiene un documento de contexto');
    return { name: document.fileName, mimeType: document.mimeType, content: await this.documents.read(document.storageKey) };
  }

  async textForEvaluation(teacherId: number, activityId: number) {
    return (await this.activities.getTeacherContext(teacherId, activityId))?.text ?? '';
  }
}
