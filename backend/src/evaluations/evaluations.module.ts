import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Valuation } from '../entities/valuation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Valuation])],
  exports: [TypeOrmModule],
})
export class EvaluationsModule {}
