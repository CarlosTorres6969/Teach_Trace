import { Module } from '@nestjs/common';
import { DocumentRepositoryService } from '../submissions/document-repository.service';

@Module({ providers: [DocumentRepositoryService], exports: [DocumentRepositoryService] })
export class DocumentStorageModule {}
