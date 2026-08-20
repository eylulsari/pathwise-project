import { Injectable, Logger } from '@nestjs/common';
import { MailerPort, PasswordResetEmail } from '../../domain/password-reset.port';

/**
 * The mailer this project currently has: none.
 *
 * Pathwise has no transactional-email provider — no account, no verified
 * domain, no API key — so there is no way to put a reset link in front of one
 * specific person. This adapter says so instead of quietly doing nothing.
 *
 * `configured` is false, and the reset service refuses on that basis before it
 * ever mints a token. Sending is still implemented as a throw rather than a
 * no-op: if a future wiring mistake routes real traffic here, it should fail
 * loudly rather than swallow a password reset and leave the traveller waiting
 * for a message that was never sent.
 *
 * TO REPLACE THIS WITH RESEND
 *   1. Add `resend.mailer.ts` next to this file: `configured` returns whether
 *      RESEND_API_KEY is set, and `sendPasswordReset` posts to their API.
 *   2. In auth.module.ts, swap the class in the `MAILER` provider.
 *   3. Set RESEND_API_KEY and APP_URL in the environment (`sync: false` in
 *      render.yaml — never in the repo).
 * Nothing in the token logic changes.
 */
@Injectable()
export class UnconfiguredMailer implements MailerPort {
  readonly configured = false;
  private readonly logger = new Logger(UnconfiguredMailer.name);

  sendPasswordReset(email: PasswordResetEmail): Promise<void> {
    this.logger.error(
      `Asked to send a password reset to ${email.to} with no mail provider ` +
        `configured. Nothing was sent. This should have been refused before ` +
        `a token was minted — see PasswordResetService.`,
    );
    return Promise.reject(new Error('No mail provider configured'));
  }
}
