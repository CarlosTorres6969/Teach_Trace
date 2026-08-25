import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LoginAttemptService {
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private readonly attempts = new Map<string, { count: number; firstAttempt: number; lockedUntil?: number }>();

  constructor(config: ConfigService) {
    this.maxAttempts = parseInt(config.get<string>('LOGIN_MAX_ATTEMPTS') ?? '5', 10);
    this.windowMs = parseInt(config.get<string>('LOGIN_WINDOW_MS') ?? '900000', 10);
  }

  private getWindowKey(email: string, timestamp: number): string {
    const window = Math.floor(timestamp / this.windowMs);
    return `${email.trim().toLowerCase()}:${window}`;
  }

  checkAttempts(email: string, timestamp: number): { allowed: boolean; retryAfter?: number } {
    const key = this.getWindowKey(email, timestamp);
    const record = this.attempts.get(key);
    const now = timestamp;

    if (record?.lockedUntil && record.lockedUntil > now) {
      return { allowed: false, retryAfter: Math.ceil((record.lockedUntil - now) / 1000) };
    }

    if (record && record.count >= this.maxAttempts) {
      record.lockedUntil = now + this.windowMs;
      return { allowed: false, retryAfter: Math.ceil(this.windowMs / 1000) };
    }

    return { allowed: true };
  }

  recordFailure(email: string, timestamp: number): void {
    const key = this.getWindowKey(email, timestamp);
    const record = this.attempts.get(key);

    if (!record || timestamp - record.firstAttempt > this.windowMs) {
      this.attempts.set(key, { count: 1, firstAttempt: timestamp });
    } else {
      record.count += 1;
      if (record.count >= this.maxAttempts) {
        record.lockedUntil = timestamp + this.windowMs;
      }
    }
  }

  recordSuccess(email: string): void {
    const prefix = email.trim().toLowerCase() + ':';
    const keys = Array.from(this.attempts.keys()).filter(k => k.startsWith(prefix));
    for (const key of keys) {
      this.attempts.delete(key);
    }
  }

  retryAfterSeconds(email: string, timestamp: number): number {
    const prefix = email.trim().toLowerCase() + ':';
    const keys = Array.from(this.attempts.keys()).filter(k => k.startsWith(prefix));
    for (const key of keys) {
      const record = this.attempts.get(key);
      if (record?.lockedUntil && record.lockedUntil > timestamp) {
        return Math.ceil((record.lockedUntil - timestamp) / 1000);
      }
    }
    return 0;
  }

  reset(email: string): void {
    const prefix = email.trim().toLowerCase() + ':';
    const keys = Array.from(this.attempts.keys()).filter(k => k.startsWith(prefix));
    for (const key of keys) {
      this.attempts.delete(key);
    }
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.attempts.entries()) {
      if (record.lockedUntil && record.lockedUntil <= now) {
        this.attempts.delete(key);
      } else if (now - record.firstAttempt > this.windowMs) {
        this.attempts.delete(key);
      }
    }
  }
}