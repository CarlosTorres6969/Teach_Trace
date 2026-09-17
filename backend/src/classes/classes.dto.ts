import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateClassDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  subject: string;

  @IsString()
  @MinLength(2)
  @MaxLength(30)
  code: string;

  @IsString()
  @MinLength(2)
  @MaxLength(40)
  period: string;
}

export class EnrollStudentDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;
}

export class EnrollStudentsDto {
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((email) => (typeof email === 'string' ? email.trim().toLowerCase() : email))
      : value,
  )
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsEmail({}, { each: true })
  emails: string[];
}
