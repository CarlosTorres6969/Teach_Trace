import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicClass } from '../entities/class.entity';
import { Enrollment } from '../entities/enrollment.entity';
import { User } from '../entities/user.entity';
import { ClassesService } from './classes.service';

@Module({
  imports: [TypeOrmModule.forFeature([AcademicClass, Enrollment, User])],
  providers: [ClassesService],
  exports: [ClassesService],
})
export class ClassesModule {}
