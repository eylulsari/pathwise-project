import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AuthUser } from '../../domain/auth-user';

/**
 * Verifies the Bearer access token and attaches an `AuthUser` to the request.
 * Downstream handlers read it via the `@CurrentUser()` decorator.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException('Missing access token');

    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        email: string;
        name: string;
      }>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });

      const authUser: AuthUser = {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
      };
      (request as Request & { user: AuthUser }).user = authUser;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  private extractToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header) return null;
    const [type, token] = header.split(' ');
    return type === 'Bearer' && token ? token : null;
  }
}
