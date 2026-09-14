import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PerformanceChartQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  classId?: number;
}
