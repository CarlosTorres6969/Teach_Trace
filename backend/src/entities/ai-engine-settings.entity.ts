import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('ai_engine_settings')
export class AiEngineSettings {
  @PrimaryColumn()
  id: number;

  @Column({ type: 'text' })
  markdown: string;
}
