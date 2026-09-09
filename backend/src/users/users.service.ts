import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { UpdateUserPreferencesDto } from './update-user-preferences.dto';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  async updatePreferences(user: User, input: UpdateUserPreferencesDto) {
    if (input.theme !== undefined) user.theme = input.theme;
    if (input.accessibilitySettings !== undefined) {
      user.accessibilitySettings = { ...input.accessibilitySettings };
    }

    const updated = await this.users.save(user);
    return {
      ...(input.theme !== undefined ? { theme: updated.theme } : {}),
      ...(input.accessibilitySettings !== undefined
        ? { accessibilitySettings: updated.accessibilitySettings }
        : {}),
    };
  }
}
