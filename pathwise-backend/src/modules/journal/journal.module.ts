import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlacesModule } from '../places/places.module';
import { JournalService } from './application/journal.service';
import { JournalController } from './infrastructure/http/journal.controller';
import { JournalEntryOrmEntity } from './infrastructure/persistence/journal-entry.orm-entity';
import { TypeOrmJournalRepository } from './infrastructure/persistence/typeorm-journal.repository';
import { JOURNAL_REPOSITORY } from './domain/journal.repository.port';

@Module({
  imports: [TypeOrmModule.forFeature([JournalEntryOrmEntity]), PlacesModule],
  controllers: [JournalController],
  providers: [
    JournalService,
    { provide: JOURNAL_REPOSITORY, useClass: TypeOrmJournalRepository },
  ],
  // Exported so A4 (personalized suggestions) can read the journal summary.
  exports: [JournalService],
})
export class JournalModule {}
