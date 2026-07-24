import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AuthService } from './application/auth.service';
import { AuthController } from './infrastructure/http/auth.controller';
import { JwtAuthGuard } from './infrastructure/guards/jwt-auth.guard';
import { RedisRefreshTokenRepository } from './infrastructure/persistence/redis-refresh-token.repository';
import { REFRESH_TOKEN_STORE } from './domain/refresh-token-store.port';

@Module({
  imports: [
    UsersModule,
    // Register JwtModule globally so JwtService (and thus JwtAuthGuard) is
    // resolvable in every module without re-importing — avoids an
    // auth<->users circular import. Secrets are passed per-sign/verify call.
    JwtModule.register({ global: true }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    // Bind the refresh-token store port to its Redis adapter.
    { provide: REFRESH_TOKEN_STORE, useClass: RedisRefreshTokenRepository },
  ],
  exports: [JwtAuthGuard],
})
export class AuthModule {}
