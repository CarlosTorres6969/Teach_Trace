import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateConversationDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(160)
  subject: string;

  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(1000)
  body: string;

  @IsInt() @Min(1)
  teacherId: number;

  @IsOptional() @IsInt() @Min(1)
  submissionId?: number;
}

export class ReplyMessageDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(1000)
  body: string;
}
