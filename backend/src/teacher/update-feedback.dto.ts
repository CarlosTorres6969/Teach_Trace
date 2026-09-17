import { IsString, MaxLength } from 'class-validator';

export class UpdateFeedbackDto {
  @IsString()
  @MaxLength(5000)
  feedback: string;
}
