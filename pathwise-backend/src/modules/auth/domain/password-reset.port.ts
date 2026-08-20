/** DI token for the password-reset token store. */
export const PASSWORD_RESET_STORE = Symbol('PASSWORD_RESET_STORE');

/** DI token for whatever actually delivers the reset link. */
export const MAILER = Symbol('MAILER');

/**
 * Where reset tokens live.
 *
 * Modelled on RefreshTokenStorePort next door, with one difference that
 * matters: the store never sees the token itself, only a hash of it. A leaked
 * refresh-token row is a session; a leaked reset-token row would be an account
 * takeover, so the row is deliberately useless on its own.
 */
export interface PasswordResetStorePort {
  save(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  /** The user this token belongs to, or null if unknown or expired. */
  findValid(tokenHash: string): Promise<{ userId: string } | null>;
  /** Single use: spend the token so the same link cannot be replayed. */
  consume(tokenHash: string): Promise<void>;
  /** Drop every outstanding token for a user — used after a successful reset. */
  revokeAllForUser(userId: string): Promise<void>;
}

export interface PasswordResetEmail {
  to: string;
  name: string;
  /** The full link the traveller clicks, token already in it. */
  resetUrl: string;
  /** How long the link stays good, so the message can say so. */
  expiresInMinutes: number;
}

export interface WelcomeEmail {
  to: string;
  name: string;
}

/**
 * The delivery channel — the part this project does not have yet.
 *
 * WHY THIS IS A PORT AND NOT A FUNCTION
 * Everything else in a password reset is arithmetic: make a random token, hash
 * it, store it, check it, spend it. That part is written and tested. What is
 * missing is a way to put the link in front of exactly one person, and that is
 * an account with a third party, a verified domain and a secret — a decision
 * rather than a line of code. Keeping it behind an interface means the day the
 * key exists, one adapter is written and one provider line changes; nothing in
 * the reset logic is touched.
 *
 * WHY `configured` IS PART OF THE CONTRACT
 * So the app can tell the truth. Without a channel, the honest answer to
 * "reset my password" is "we cannot do that yet, here is how to reach a
 * human" — not a reassuring "check your inbox" for a message nobody sent.
 * The service reads this flag and refuses rather than pretending.
 */
export interface MailerPort {
  readonly configured: boolean;
  sendWelcome(email: WelcomeEmail): Promise<void>;
  sendPasswordReset(email: PasswordResetEmail): Promise<void>;
}
