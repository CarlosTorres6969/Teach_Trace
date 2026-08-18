import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

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
}
