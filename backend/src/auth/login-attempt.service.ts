import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type AttemptBucket = {
  failures: number;
  expiresAt: number;
};

@Injectable()
export class LoginAttemptService {
  private readonly attempts = new Map<string, AttemptBucket>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;

  constructor(config: ConfigService) {
    this.maxAttempts = this.positiveInteger(config.get<string>('LOGIN_MAX_ATTEMPTS'), 5);
    this.windowMs = this.positiveInteger(config.get<string>('LOGIN_WINDOW_MS'), 15 * 60 * 1000);
  }

  retryAfterSeconds(email: string, now = Date.now()): number {
    const key = this.key(email);
    const bucket = this.attempts.get(key);
    if (!bucket) return 0;
    if (bucket.expiresAt <= now) {
      this.attempts.delete(key);
      return 0;
    }
    if (bucket.failures < this.maxAttempts) return 0;
    return Math.max(1, Math.ceil((bucket.expiresAt - now) / 1000));
  }

  recordFailure(email: string, now = Date.now()) {
    const key = this.key(email);
    const current = this.attempts.get(key);
    if (!current || current.expiresAt <= now) {
      this.attempts.set(key, { failures: 1, expiresAt: now + this.windowMs });
      return;
    }
    current.failures += 1;
  }

  reset(email: string) {
    this.attempts.delete(this.key(email));
  }

  private key(email: string) {
    return email.trim().toLowerCase();
  }

  private positiveInteger(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }
}
