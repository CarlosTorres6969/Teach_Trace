import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { UpdateAiDeclarationDto } from '../ai-declarations/update-ai-declaration.dto';

export class SubmitEvidenceDto extends UpdateAiDeclarationDto {
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const normalized = value.trim();
    return /^[1-3]$/.test(normalized) ? Number(normalized) : value;
  })
  @IsInt()
  @Min(1)
  @Max(3)
  declare usageLevel: number;

  @IsString()
  @MaxLength(50000)
  productText: string;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @ValidateIf((value: SubmitEvidenceDto) => value.productUrl !== '')
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  productUrl?: string;
}
