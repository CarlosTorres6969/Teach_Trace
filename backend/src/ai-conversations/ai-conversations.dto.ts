import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { AiMessageRole } from '../entities/ai-conversation.entity';

export class AiMessageDto {
  @IsEnum(AiMessageRole)
  role: AiMessageRole;

  @IsString()
  @MaxLength(20000)
  content: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sequence?: number;
}

export class UpdateAiConversationDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AiMessageDto)
  messages: AiMessageDto[];
}
