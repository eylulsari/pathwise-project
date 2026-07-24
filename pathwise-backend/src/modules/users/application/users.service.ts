import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { User } from '../domain/user';
import {
  CreateUserData,
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../domain/user.repository.port';

/**
 * Application service — orchestrates the domain. Depends on the repository
 * *port*, never on the TypeORM adapter directly (dependency inversion).
 */
@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly users: UserRepositoryPort,
  ) {}

  create(data: CreateUserData): Promise<User> {
    return this.users.create(data);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findByEmail(email);
  }

  async findById(id: string): Promise<User> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** Public profile view for `GET /users/me`. */
  async getPublicProfile(id: string) {
    const user = await this.findById(id);
    return user.toPublic();
  }
}
