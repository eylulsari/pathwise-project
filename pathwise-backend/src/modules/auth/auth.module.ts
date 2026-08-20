import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AuthService } from './application/auth.service';
import { AuthController } from './infrastructure/http/auth.controller';
import { JwtAuthGuard } from './infrastructure/guards/jwt-auth.guard';
import { TypeOrmRefreshTokenRepository } from './infrastructure/persistence/typeorm-refresh-token.repository';
import { RefreshTokenOrmEntity } from './infrastructure/persistence/refresh-token.orm-entity';
import { REFRESH_TOKEN_STORE } from './domain/refresh-token-store.port';
import { PasswordResetService } from './application/password-reset.service';
import { PasswordResetTokenOrmEntity } from './infrastructure/persistence/password-reset-token.orm-entity';
import { TypeOrmPasswordResetRepository } from './infrastructure/persistence/typeorm-password-reset.repository';
import { EmailService } from './infrastructure/mail/email.service';
import { MAILER, PASSWORD_RESET_STORE } from './domain/password-reset.port';

@Module({
  imports: [
    TypeOrmModule.forFeature([RefreshTokenOrmEntity, PasswordResetTokenOrmEntity]),
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
    // Postgres-backed since Redis was removed: sessions now survive a restart.
    { provide: REFRESH_TOKEN_STORE, useClass: TypeOrmRefreshTokenRepository },
    PasswordResetService,
    { provide: PASSWORD_RESET_STORE, useClass: TypeOrmPasswordResetRepository },
    EmailService,
    { provide: MAILER, useExisting: EmailService },
  ],
  exports: [JwtAuthGuard],
})
export class AuthModule {}
