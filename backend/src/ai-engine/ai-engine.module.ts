import { Module } from '@nestjs/common';
import { AiEngineService } from './ai-engine.service';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiEngineSettings } from '../entities/ai-engine-settings.entity';
import { AiEngineSettingsService } from './ai-engine-settings.service';
import { VercelAiSyncService } from './vercel-ai-sync.service';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([AiEngineSettings])],
  providers: [AiEngineService, AiEngineSettingsService, VercelAiSyncService],
  exports: [AiEngineService, AiEngineSettingsService],
})
export class AiEngineModule {}
