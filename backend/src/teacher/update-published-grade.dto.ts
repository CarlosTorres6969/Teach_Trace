import { IsNumber, Max, Min } from 'class-validator';

export class UpdatePublishedGradeDto {
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(100)
  gradePercentage: number;
}
