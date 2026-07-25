import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { UsersService } from '../../users/application/users.service';
import { User } from '../../users/domain/user';
import {
  REFRESH_TOKEN_STORE,
  RefreshTokenStorePort,
} from '../domain/refresh-token-store.port';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

interface AccessPayload {
  sub: string;
  email: string;
  name: string;
}
interface RefreshPayload {
  sub: string;
  jti: string;
}

@Injectable()
export class AuthService {
  private static readonly SALT_ROUNDS = 10;

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(REFRESH_TOKEN_STORE)
    private readonly refreshStore: RefreshTokenStorePort,
  ) {}

  // ── Public use-cases ──────────────────────────────────────────────

  async register(dto: RegisterDto) {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email is already registered');

    const passwordHash = await bcrypt.hash(dto.password, AuthService.SALT_ROUNDS);
    const created = await this.users.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
      nationality: dto.nationality ?? null,
      age: dto.age ?? null,
    });

    // A6 — every new account gets a 7-day Premium trial.
    await this.users.startTrial(created.id, 7);
    const user = await this.users.findById(created.id);

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    return this.buildAuthResponse(user);
  }

  async refresh(refreshToken: string) {
    let payload: RefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const valid = await this.refreshStore.isValid(payload.sub, payload.jti);
    if (!valid) throw new UnauthorizedException('Refresh token revoked');

    // Rotate: revoke the presented token, issue a fresh pair.
    await this.refreshStore.revoke(payload.sub, payload.jti);
    const user = await this.users.findById(payload.sub);
    return this.buildAuthResponse(user);
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
      await this.refreshStore.revoke(userId, payload.jti);
    } catch {
      // Token already invalid/expired — nothing to revoke.
    }
  }

  // ── Token helpers ─────────────────────────────────────────────────

  private async buildAuthResponse(user: User) {
    const accessToken = await this.signAccessToken(user);
    const refreshToken = await this.signRefreshToken(user);
    return { user: user.toPublic(), accessToken, refreshToken };
  }

  private signAccessToken(user: User): Promise<string> {
    const payload: AccessPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
    };
    return this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '15m'),
    });
  }

  private async signRefreshToken(user: User): Promise<string> {
    const jti = uuid();
    const ttl = this.config.get<string>('JWT_REFRESH_TTL', '7d');
    const token = await this.jwt.signAsync(
      { sub: user.id, jti } as RefreshPayload,
      { secret: this.config.get<string>('JWT_REFRESH_SECRET'), expiresIn: ttl },
    );
    await this.refreshStore.save(user.id, jti, this.ttlToSeconds(ttl));
    return token;
  }

  /** Convert a TTL like "7d" / "15m" / "3600s" to seconds. */
  private ttlToSeconds(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl.trim());
    if (!match) return Number(ttl) || 604800;
    const value = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };
    return value * multipliers[unit];
  }
}
