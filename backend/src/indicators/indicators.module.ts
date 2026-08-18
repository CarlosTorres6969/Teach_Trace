import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Indicator } from '../entities/indicator.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Indicator])],
  exports: [TypeOrmModule],
})
export class IndicatorsModule {}
