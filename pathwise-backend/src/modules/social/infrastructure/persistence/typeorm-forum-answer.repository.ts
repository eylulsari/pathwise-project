import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreateForumAnswerData,
  ForumAnswerRepositoryPort,
  PersistedForumAnswer,
} from '../../domain/forum-answer.repository.port';
import { ForumAnswerOrmEntity } from './forum-answer.orm-entity';

/** Repository Pattern — the TypeORM adapter for forum answers. */
@Injectable()
export class TypeOrmForumAnswerRepository implements ForumAnswerRepositoryPort {
  constructor(
    @InjectRepository(ForumAnswerOrmEntity)
    private readonly repo: Repository<ForumAnswerOrmEntity>,
  ) {}

  private toDomain(row: ForumAnswerOrmEntity): PersistedForumAnswer {
    return {
      id: row.id,
      questionId: row.questionId,
      userId: row.userId,
      authorName: row.authorName,
      text: row.text,
      createdAt: row.createdAt,
    };
  }

  async create(data: CreateForumAnswerData): Promise<PersistedForumAnswer> {
    const saved = await this.repo.save(this.repo.create(data));
    return this.toDomain(saved);
  }

  async listAll(): Promise<PersistedForumAnswer[]> {
    // The forum is a small curated set of threads, so one read and an
    // in-memory group-by beats a query per thread.
    const rows = await this.repo.find({ order: { createdAt: 'ASC' } });
    return rows.map((r) => this.toDomain(r));
  }
}
