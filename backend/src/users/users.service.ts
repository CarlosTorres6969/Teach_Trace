import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { UpdateUserPreferencesDto } from './update-user-preferences.dto';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  async updatePreferences(user: User, input: UpdateUserPreferencesDto) {
    user.theme = input.theme;
    const updated = await this.users.save(user);
    return { theme: updated.theme };
  }
}
