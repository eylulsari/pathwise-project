import { Global, Module } from '@nestjs/common';
import { MemoryStoreService } from './memory-store.service';

/**
 * Global in-process store for caches and quota counters.
 *
 * Replaces the Redis module. Kept global for the same reason that one was:
 * guards in `common/` and services across several features all need it, and
 * threading an import through every module would add noise without adding
 * safety.
 *
 * See `MemoryStoreService` for the single-instance caveat.
 */
@Global()
@Module({
  providers: [MemoryStoreService],
  exports: [MemoryStoreService],
})
export class CacheModule {}
