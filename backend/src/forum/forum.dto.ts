import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateForumThreadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description: string;
}

export class CreateForumPostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  parentPostId?: number;
}

export class UpdatePinnedDto {
  @IsBoolean()
  pinned: boolean;
}

export class UpdateResolvedDto {
  @IsBoolean()
  resolved: boolean;
}
