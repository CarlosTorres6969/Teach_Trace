import { IsOptional, IsString, IsUrl, MaxLength, ValidateIf } from 'class-validator';

export class SubmitProductDto {
  @IsString()
  @MaxLength(50000)
  productText: string;

  @IsOptional()
  @ValidateIf((value: SubmitProductDto) => value.productUrl !== '')
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  productUrl?: string;
}
