import { IsInt, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export const MAX_SUBMISSION_FILE_SIZE = 10 * 1024 * 1024;

export class PrepareSubmissionUploadDto {
  @IsString()
  @MaxLength(255)
  @Matches(/\.pdf$/i, { message: 'El archivo de la entrega debe ser un PDF' })
  fileName: string;

  @IsInt()
  @Min(5)
  @Max(MAX_SUBMISSION_FILE_SIZE, { message: 'El archivo no puede superar 10 MB' })
  fileSize: number;
}
