import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from '../../modules/users/application/users.service';
import { AuthUser } from '../../modules/auth/domain/auth-user';

/**
 * Gates premium-only endpoints. Must run AFTER JwtAuthGuard (which sets
 * req.user). Loads the caller's tier and returns 402 Payment Required for
 * free users so the client can surface an upgrade prompt.
 */
@Injectable()
export class PremiumGuard implements CanActivate {
  constructor(private readonly users: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    if (!req.user) {
      throw new HttpException('Authentication required', HttpStatus.UNAUTHORIZED);
    }
    const user = await this.users.findById(req.user.id);
    if (!user.isPremium) {
      throw new HttpException(
        { statusCode: HttpStatus.PAYMENT_REQUIRED, message: 'Premium feature', error: 'PaymentRequired' },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    return true;
  }
}
