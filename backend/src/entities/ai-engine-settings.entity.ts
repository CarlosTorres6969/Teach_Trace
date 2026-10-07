import { Column, Entity, PrimaryColumn } from 'typeorm';
import { AiStageInstructions } from '../ai-engine/ai-stage-instructions';

@Entity('ai_engine_settings')
export class AiEngineSettings {
  @PrimaryColumn()
  id: number;

  @Column({ type: 'text' })
  markdown: string;

  @Column({ type: 'simple-json', nullable: true })
  stageInstructions: AiStageInstructions | null;

  @Column({ type: 'text', nullable: true })
  encryptedApiKey: string | null;
}
