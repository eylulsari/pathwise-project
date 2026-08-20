import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';
import type { ConfigService } from '@nestjs/config';
import type { UsersService } from '../../users/application/users.service';
import { PasswordResetService } from './password-reset.service';
import type {
  MailerPort,
  PasswordResetEmail,
  PasswordResetStorePort,
} from '../domain/password-reset.port';
import type { RefreshTokenStorePort } from '../domain/refresh-token-store.port';

/**
 * A reset flow is an account-takeover mechanism that happens to be useful, so
 * what is checked here is mostly what it refuses to do.
 */

const USER = { id: 'u1', email: 'ayla@std.antalya.edu.tr', name: 'Ayla' };

function build(opts: { configured?: boolean; knownEmail?: boolean } = {}) {
  const rows = new Map<string, { userId: string; expiresAt: Date }>();
  const sent: PasswordResetEmail[] = [];
  const passwords: { id: string; hash: string }[] = [];
  const revokedSessions: string[] = [];

  const store: PasswordResetStorePort = {
    save: (userId, tokenHash, expiresAt) => {
      rows.set(tokenHash, { userId, expiresAt });
      return Promise.resolve();
    },
    findValid: (tokenHash) => {
      const row = rows.get(tokenHash);
      if (!row) return Promise.resolve(null);
      if (row.expiresAt.getTime() <= Date.now()) return Promise.resolve(null);
      return Promise.resolve({ userId: row.userId });
    },
    consume: (tokenHash) => {
      rows.delete(tokenHash);
      return Promise.resolve();
    },
    revokeAllForUser: (userId) => {
      for (const [hash, row] of rows) if (row.userId === userId) rows.delete(hash);
      return Promise.resolve();
    },
  };

  const mailer: MailerPort = {
    configured: opts.configured ?? true,
    sendPasswordReset: (email) => {
      sent.push(email);
      return Promise.resolve();
    },
  };

  const service = new PasswordResetService(
    {
      findByEmail: () =>
        Promise.resolve(opts.knownEmail === false ? null : (USER as never)),
      setPasswordHash: (id: string, hash: string) => {
        passwords.push({ id, hash });
        return Promise.resolve();
      },
    } as unknown as UsersService,
    { get: () => 'https://pathwise.example' } as unknown as ConfigService,
    store,
    {
      revokeAllForUser: (userId: string) => {
        revokedSessions.push(userId);
        return Promise.resolve();
      },
    } as unknown as RefreshTokenStorePort,
    mailer,
  );

  const tokenFrom = (email: PasswordResetEmail) =>
    new URL(email.resetUrl).searchParams.get('token')!;

  return { service, rows, sent, passwords, revokedSessions, tokenFrom };
}

describe('PasswordResetService — with no mail provider', () => {
  it('refuses, rather than claiming to have sent something', async () => {
    // The tempting version returns 204 "if that address exists we have emailed
    // you", which reads as reassurance for a message nobody sent.
    const { service } = build({ configured: false });
    await expect(service.requestReset(USER.email)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('mints no token it cannot deliver', async () => {
    const { service, rows } = build({ configured: false });
    await service.requestReset(USER.email).catch(() => {});
    expect(rows.size).toBe(0);
  });

  it('reports itself unavailable so the client can say so', () => {
    expect(build({ configured: false }).service.available).toBe(false);
    expect(build({ configured: true }).service.available).toBe(true);
  });
});

describe('PasswordResetService — requesting a reset', () => {
  it('sends a link with a token in it', async () => {
    const { service, sent } = build();
    await service.requestReset(USER.email);

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(USER.email);
    const token = new URL(sent[0].resetUrl).searchParams.get('token');
    expect(token).toMatch(/^[0-9a-f]{64}$/); // 32 random bytes as hex
  });

  it('stores only a hash of the token, never the token', async () => {
    // The row is what a database dump hands an attacker. It has to be useless.
    const { service, sent, rows, tokenFrom } = build();
    await service.requestReset(USER.email);

    const token = tokenFrom(sent[0]);
    expect(rows.has(token)).toBe(false);
    expect(rows.has(createHash('sha256').update(token).digest('hex'))).toBe(true);
  });

  it('says nothing about whether an address is registered', async () => {
    // Otherwise the endpoint answers "does this person use Pathwise?".
    const known = build();
    const unknown = build({ knownEmail: false });

    await expect(known.service.requestReset(USER.email)).resolves.toBeUndefined();
    await expect(
      unknown.service.requestReset('nobody@std.antalya.edu.tr'),
    ).resolves.toBeUndefined();
    // And nothing is sent to the address that has no account.
    expect(unknown.sent).toHaveLength(0);
  });

  it('gives the link a deadline', async () => {
    const { service, sent } = build();
    await service.requestReset(USER.email);
    expect(sent[0].expiresInMinutes).toBe(30);
  });
});

describe('PasswordResetService — completing a reset', () => {
  it('sets the new password', async () => {
    const { service, sent, passwords, tokenFrom } = build();
    await service.requestReset(USER.email);

    await service.completeReset(tokenFrom(sent[0]), 'a-brand-new-password');

    expect(passwords).toHaveLength(1);
    expect(passwords[0].id).toBe(USER.id);
    // Hashed, obviously — but assert it rather than trust it.
    expect(passwords[0].hash).not.toContain('a-brand-new-password');
    expect(await bcrypt.compare('a-brand-new-password', passwords[0].hash)).toBe(true);
  });

  it('spends the link, so the same one cannot be walked twice', async () => {
    // A reset link lives in an inbox forever. Without this it is a standing
    // key to the account.
    const { service, sent, tokenFrom } = build();
    await service.requestReset(USER.email);
    const token = tokenFrom(sent[0]);

    await service.completeReset(token, 'first-new-password');
    await expect(service.completeReset(token, 'second-attempt')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('ends every session the account had', async () => {
    // The reason someone resets a password is often that somebody else is in
    // the account. Leaving that session alive makes the reset ceremonial.
    const { service, sent, revokedSessions, tokenFrom } = build();
    await service.requestReset(USER.email);

    await service.completeReset(tokenFrom(sent[0]), 'a-brand-new-password');
    expect(revokedSessions).toEqual([USER.id]);
  });

  it('invalidates any other outstanding link for that account', async () => {
    const { service, sent, rows, tokenFrom } = build();
    await service.requestReset(USER.email);
    await service.requestReset(USER.email);
    expect(rows.size).toBe(2);

    await service.completeReset(tokenFrom(sent[0]), 'a-brand-new-password');
    expect(rows.size).toBe(0);
  });

  it('refuses a token nobody issued', async () => {
    const { service } = build();
    await expect(
      service.completeReset('f'.repeat(64), 'a-brand-new-password'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses an expired token, and says the same thing as for a bad one', async () => {
    const { service, sent, rows, tokenFrom } = build();
    await service.requestReset(USER.email);
    const token = tokenFrom(sent[0]);
    // Wind the stored deadline into the past.
    const hash = createHash('sha256').update(token).digest('hex');
    rows.get(hash)!.expiresAt = new Date(Date.now() - 1000);

    // Same error as an unknown token: separating them would report whether a
    // token ever existed.
    await expect(service.completeReset(token, 'a-new-password')).rejects.toThrow(
      /invalid or has expired/i,
    );
  });

  it('leaves the password alone when the token is bad', async () => {
    const { service, passwords } = build();
    await service.completeReset('f'.repeat(64), 'a-new-password').catch(() => {});
    expect(passwords).toHaveLength(0);
  });
});
