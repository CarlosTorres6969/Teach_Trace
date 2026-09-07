import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SavePushSubscriptionDto {
  @IsString() @IsNotEmpty() endpoint: string;
  @IsString() @IsNotEmpty() p256dh: string;
  @IsString() @IsNotEmpty() auth: string;
}

export class DeletePushSubscriptionDto {
  @IsString() @IsNotEmpty() endpoint: string;
}

export class MarkNotificationReadDto {
  @IsBoolean() read: boolean;
}

export class MarkAllReadDto {
  @IsOptional() @IsBoolean() read?: boolean;
}
