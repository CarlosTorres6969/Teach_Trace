import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../entities/user.entity';
import { CreateTeacherDto, UpdateAiEngineSettingsDto } from './admin.dto';
import { AiEngineSettingsService } from '../ai-engine/ai-engine-settings.service';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly aiSettings: AiEngineSettingsService,
  ) {}

  @Get('ai-engine')
  getAiSettings() {
    return this.aiSettings.getSettings();
  }

  @Put('ai-engine')
  saveAiSettings(@Body() input: UpdateAiEngineSettingsDto) {
    return this.aiSettings.saveSettings(input.markdown);
  }

  @Get('teachers')
  listTeachers() {
    return this.adminService.listTeachers();
  }

  @Post('teachers')
  createTeacher(@Body() input: CreateTeacherDto) {
    return this.adminService.createTeacher(input);
  }
}
