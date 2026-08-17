import { Inject, Injectable } from '@nestjs/common';
import { PLAN_REPOSITORY, PlanRepositoryPort } from '../domain/plan.repository.port';

@Injectable()
export class PlanService {
  constructor(
    @Inject(PLAN_REPOSITORY) private readonly repo: PlanRepositoryPort,
  ) {}

  /** Null means "never edited", which the dashboard reads as "generate fresh". */
  find(userId: string): Promise<unknown[] | null> {
    return this.repo.find(userId);
  }

  save(userId: string, days: Record<string, unknown>[]): Promise<void> {
    return this.repo.save(userId, days);
  }

  clear(userId: string): Promise<void> {
    return this.repo.clear(userId);
  }
}
