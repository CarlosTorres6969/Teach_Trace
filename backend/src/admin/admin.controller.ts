import { Body, Controller, Delete, Get, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../entities/user.entity';
import { CreateTeacherDto, UpdateAiApiKeyDto, UpdateAiEngineSettingsDto, UpdateAiStageSettingsDto } from './admin.dto';
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

  @Put('ai-engine/instructions')
  saveAiStageSettings(@Body() input: UpdateAiStageSettingsDto) {
    return this.aiSettings.saveStageSettings(input);
  }

  @Put('ai-engine/api-key')
  saveAiApiKey(@Body() input: UpdateAiApiKeyDto) {
    return this.aiSettings.saveApiKey(input.apiKey);
  }

  @Delete('ai-engine/api-key')
  restoreServerApiKey() {
    return this.aiSettings.restoreServerApiKey();
  }

  @Post('ai-engine/api-key/sync')
  retryVercelSync() {
    return this.aiSettings.retryVercelSync();
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
