import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { User } from '../../users/domain/user';
import { UsersService } from '../../users/application/users.service';
import { RefreshTokenStorePort } from '../domain/refresh-token-store.port';

function makeUser(passwordHash: string): User {
  return new User({
    id: 'user-1',
    name: 'Aylin Demir',
    email: 'aylin@example.com',
    passwordHash,
    nationality: 'Turkey',
    age: 22,
    travelStyles: [],
    bio: null,
    createdAt: new Date(),
  });
}

describe('AuthService', () => {
  let users: jest.Mocked<Pick<UsersService, 'findByEmail' | 'create' | 'findById'>>;
  let refreshStore: jest.Mocked<RefreshTokenStorePort>;
  let jwt: { signAsync: jest.Mock; verifyAsync: jest.Mock };
  let config: { get: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    users = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
    };
    refreshStore = { save: jest.fn(), isValid: jest.fn(), revoke: jest.fn() };
    jwt = {
      signAsync: jest.fn().mockResolvedValue('signed.jwt.token'),
      verifyAsync: jest.fn(),
    };
    config = { get: jest.fn((key: string, def?: unknown) => def ?? 'secret') };

    service = new AuthService(
      users as unknown as UsersService,
      jwt as never,
      config as never,
      refreshStore,
    );
  });

  describe('register', () => {
    it('rejects a duplicate email', async () => {
      users.findByEmail.mockResolvedValue(makeUser('hash'));
      await expect(
        service.register({ name: 'Aylin Demir', email: 'aylin@example.com', password: 'secret123' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('hashes the password and issues tokens', async () => {
      users.findByEmail.mockResolvedValue(null);
      users.create.mockImplementation(async (data) => makeUser(data.passwordHash));

      const res = await service.register({
        name: 'Aylin Demir',
        email: 'aylin@example.com',
        password: 'secret123',
      });

      const created = users.create.mock.calls[0][0];
      expect(created.passwordHash).not.toBe('secret123');
      expect(await bcrypt.compare('secret123', created.passwordHash)).toBe(true);
      expect(res.accessToken).toBeDefined();
      expect(res.refreshToken).toBeDefined();
      expect(res.user).not.toHaveProperty('passwordHash');
      expect(refreshStore.save).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('rejects unknown email', async () => {
      users.findByEmail.mockResolvedValue(null);
      await expect(
        service.login({ email: 'nope@example.com', password: 'x' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a wrong password', async () => {
      const hash = await bcrypt.hash('correct', 10);
      users.findByEmail.mockResolvedValue(makeUser(hash));
      await expect(
        service.login({ email: 'aylin@example.com', password: 'wrong' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('accepts a correct password and returns tokens', async () => {
      const hash = await bcrypt.hash('correct', 10);
      users.findByEmail.mockResolvedValue(makeUser(hash));
      const res = await service.login({ email: 'aylin@example.com', password: 'correct' });
      expect(res.accessToken).toBeDefined();
      expect(res.user.email).toBe('aylin@example.com');
    });
  });

  describe('refresh', () => {
    it('rotates a valid refresh token (revoke old, issue new)', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', jti: 'jti-1' });
      refreshStore.isValid.mockResolvedValue(true);
      users.findById.mockResolvedValue(makeUser('hash'));

      const res = await service.refresh('some.refresh.token');
      expect(refreshStore.revoke).toHaveBeenCalledWith('user-1', 'jti-1');
      expect(refreshStore.save).toHaveBeenCalled(); // new token persisted
      expect(res.accessToken).toBeDefined();
    });

    it('rejects a revoked/unknown refresh token', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', jti: 'jti-1' });
      refreshStore.isValid.mockResolvedValue(false);
      await expect(service.refresh('token')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an unverifiable refresh token', async () => {
      jwt.verifyAsync.mockRejectedValue(new Error('bad signature'));
      await expect(service.refresh('token')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('revokes the presented refresh token', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', jti: 'jti-1' });
      await service.logout('user-1', 'token');
      expect(refreshStore.revoke).toHaveBeenCalledWith('user-1', 'jti-1');
    });

    it('swallows errors for an already-invalid token', async () => {
      jwt.verifyAsync.mockRejectedValue(new Error('expired'));
      await expect(service.logout('user-1', 'token')).resolves.toBeUndefined();
    });
  });
});
