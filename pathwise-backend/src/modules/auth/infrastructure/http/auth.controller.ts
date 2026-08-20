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
import {
  ForgotPasswordDto,
  ResetPasswordDto,
} from '../../application/dto/password-reset.dto';
import { PasswordResetService } from '../../application/password-reset.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { AuthUser } from '../../domain/auth-user';
import { EmailService } from '../mail/email.service';

const REFRESH_COOKIE = 'pw_refresh';

// Auth endpoints are the prime brute-force target. Limit is env-configurable
// (default 10/min/IP for prod; raised in dev/CI where E2E registers many users).
const AUTH_THROTTLE_LIMIT = Number(process.env.AUTH_THROTTLE_LIMIT ?? 10);

// Tighter still. An accepted reset request sends mail to an address the caller
// chose, so the cheap abuse is using it to post messages to strangers.
const RESET_THROTTLE_LIMIT = Number(process.env.RESET_THROTTLE_LIMIT ?? 5);

@Throttle({ default: { ttl: 60000, limit: AUTH_THROTTLE_LIMIT } })
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly reset: PasswordResetService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {}

  /** POST /api/auth/register */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { refreshToken, ...rest } = await this.auth.register(dto);
    this.setRefreshCookie(res, refreshToken);
    // A welcome email is useful, but delivery must not turn a successfully
    // created account into a failed registration response.
    if (this.email.configured) {
      try {
        await this.email.sendWelcome({ to: rest.user.email, name: rest.user.name });
      } catch {
        // EmailService logs delivery failures without exposing provider details.
      }
    }
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

  /**
   * POST /api/auth/forgot-password
   *
   * Always 204 when the feature is on, whether or not the address is
   * registered: a different answer for a known address would turn this into a
   * way of finding out who has an account.
   *
   * 503 when there is no mail provider, which is the state today. The client
   * shows a "contact support" message on that basis rather than a form that
   * cannot deliver anything.
   *
   * Throttled harder than the rest of auth. Each accepted call sends mail to
   * an address the caller chose, so the cheap abuse here is using the endpoint
   * as a way to post messages to strangers.
   */
  @Throttle({ default: { ttl: 60000, limit: RESET_THROTTLE_LIMIT } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.reset.requestReset(dto.email);
  }

  /**
   * POST /api/auth/reset-password
   *
   * One error for every kind of bad token — unknown, expired, already spent.
   * They are the same fact to whoever holds the link, and separating them
   * would report whether a token ever existed.
   */
  @Throttle({ default: { ttl: 60000, limit: RESET_THROTTLE_LIMIT } })
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.reset.completeReset(dto.token, dto.password);
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
