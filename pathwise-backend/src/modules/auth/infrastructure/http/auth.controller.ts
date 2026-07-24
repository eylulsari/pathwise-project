import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuthService } from '../../application/auth.service';
import { RegisterDto } from '../../application/dto/register.dto';
import { LoginDto } from '../../application/dto/login.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { AuthUser } from '../../domain/auth-user';

const REFRESH_COOKIE = 'pw_refresh';

// Auth endpoints are the prime brute-force target — 10 requests / minute / IP.
@Throttle({ default: { ttl: 60000, limit: 10 } })
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  /** POST /api/auth/register */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { refreshToken, ...rest } = await this.auth.register(dto);
    this.setRefreshCookie(res, refreshToken);
    return rest; // { user, accessToken }
  }

  /** POST /api/auth/login */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { refreshToken, ...rest } = await this.auth.login(dto);
    this.setRefreshCookie(res, refreshToken);
    return rest;
  }

  /** POST /api/auth/refresh — rotates using the httpOnly cookie. */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new UnauthorizedException('No refresh token');
    const { refreshToken, ...rest } = await this.auth.refresh(token);
    this.setRefreshCookie(res, refreshToken);
    return rest;
  }

  /** POST /api/auth/logout — revokes the refresh token and clears the cookie. */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) await this.auth.logout(user.id, token);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get<string>('NODE_ENV') === 'production',
      path: '/api/auth', // only sent to the auth endpoints
      maxAge: this.refreshTtlMs(),
    });
  }

  private refreshTtlMs(): number {
    const ttl = this.config.get<string>('JWT_REFRESH_TTL', '7d');
    const m = /^(\d+)([smhd])$/.exec(ttl.trim());
    if (!m) return 7 * 86400 * 1000;
    const mult: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return Number(m[1]) * mult[m[2]];
  }
}
