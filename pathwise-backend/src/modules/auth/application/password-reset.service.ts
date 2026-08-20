import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../../users/application/users.service';
import {
  MAILER,
  MailerPort,
  PASSWORD_RESET_STORE,
  PasswordResetStorePort,
} from '../domain/password-reset.port';
import {
  REFRESH_TOKEN_STORE,
  RefreshTokenStorePort,
} from '../domain/refresh-token-store.port';

/**
 * Password reset — the arithmetic half.
 *
 * The whole feature is two questions: how do you prove someone owns an
 * address, and how do you reach them at it. This class answers the first and
 * refuses to fake the second.
 *
 * WHAT IS ENFORCED HERE
 *  · The token is 32 random bytes from the CSPRNG, not a JWT. A JWT would put
 *    the reset authority in a string anyone holding it can read and replay
 *    until it expires; this is an opaque handle to a row we can delete.
 *  · Only its SHA-256 is stored, so a database dump is not a set of account
 *    takeovers.
 *  · Single use. Verifying spends it, so the same link cannot be walked twice
 *    — a link that lives in an inbox forever is a standing key otherwise.
 *  · Short-lived (30 minutes by default).
 *  · A completed reset revokes every other outstanding reset token AND every
 *    refresh token the account has. If the reset was somebody else recovering
 *    a stolen session, the point of it is to end that session.
 *  · `requestReset` never says whether an address is registered. Answering
 *    honestly there turns the endpoint into a membership oracle.
 *
 * WHAT IS NOT DONE HERE
 * Delivery. See MailerPort: with no provider configured this refuses before
 * minting anything, rather than returning a soothing "check your inbox" for a
 * message that was never sent.
 */
@Injectable()
export class PasswordResetService {
  private static readonly TOKEN_BYTES = 32;
  private static readonly TTL_MINUTES = 30;
  private static readonly SALT_ROUNDS = 10;

  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly users: UsersService,
    private readonly config: ConfigService,
    @Inject(PASSWORD_RESET_STORE)
    private readonly store: PasswordResetStorePort,
    @Inject(REFRESH_TOKEN_STORE)
    private readonly refreshStore: RefreshTokenStorePort,
    @Inject(MAILER)
    private readonly mailer: MailerPort,
  ) {}

  /** Whether the feature can work at all right now. Read by the controller. */
  get available(): boolean {
    return this.mailer.configured;
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Start a reset. Says nothing about whether the address is registered.
   *
   * Returns normally in every case a caller is allowed to distinguish, which
   * is exactly one: it worked, or the feature is switched off.
   */
  async requestReset(email: string): Promise<void> {
    if (!this.mailer.configured) {
      // Refused BEFORE a token exists. Minting one nobody can receive would
      // leave rows in the table for links that were never sent.
      throw new ServiceUnavailableException(
        'Password reset is not available yet — please contact support',
      );
    }

    const user = await this.users.findByEmail(email);
    if (!user) {
      // Deliberately silent. The caller gets the same answer either way, so
      // this endpoint cannot be used to find out who has an account.
      this.logger.debug(`Reset requested for an unknown address`);
      return;
    }

    const token = randomBytes(PasswordResetService.TOKEN_BYTES).toString('hex');
    const expiresAt = new Date(
      Date.now() + PasswordResetService.TTL_MINUTES * 60_000,
    );
    await this.store.save(user.id, this.hash(token), expiresAt);

    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:5173';
    await this.mailer.sendPasswordReset({
      to: user.email,
      name: user.name,
      resetUrl: `${appUrl}/reset-password?token=${token}`,
      expiresInMinutes: PasswordResetService.TTL_MINUTES,
    });
  }

  /**
   * Finish a reset.
   *
   * One error for every way of failing — unknown token, expired token, already
   * used token. They are the same fact to the person holding the link, and
   * telling them apart would say whether a token ever existed.
   */
  async completeReset(token: string, newPassword: string): Promise<void> {
    const tokenHash = this.hash(token);
    const found = await this.store.findValid(tokenHash);
    if (!found) {
      throw new BadRequestException('This reset link is invalid or has expired');
    }

    // Spent before the password is written: if anything below fails, the link
    // is still dead. A token that survives its own failed use is a token that
    // can be retried by whoever else has the link.
    await this.store.consume(tokenHash);

    const passwordHash = await bcrypt.hash(
      newPassword,
      PasswordResetService.SALT_ROUNDS,
    );
    await this.users.setPasswordHash(found.userId, passwordHash);

    // Everything else this account had is now void. If the reset happened
    // because somebody else was in the account, leaving their session alive
    // would make the reset ceremonial.
    await this.store.revokeAllForUser(found.userId);
    await this.refreshStore.revokeAllForUser(found.userId);

    this.logger.log(`Password reset completed for user ${found.userId}`);
  }
}
