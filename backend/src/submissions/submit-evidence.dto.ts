import { IsOptional, IsString, IsUrl, MaxLength, ValidateIf } from 'class-validator';
import { UpdateAiDeclarationDto } from '../ai-declarations/update-ai-declaration.dto';

export class SubmitEvidenceDto extends UpdateAiDeclarationDto {
  @IsString()
  @MaxLength(50000)
  productText: string;

  @IsOptional()
  @ValidateIf((value: SubmitEvidenceDto) => value.productUrl !== '')
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  productUrl?: string;
}
