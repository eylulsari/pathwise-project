import { Module } from '@nestjs/common';
import { CurrencyService } from './application/currency.service';
import { CurrencyController } from './infrastructure/http/currency.controller';

/**
 * Live exchange rates via Frankfurter (free, key-less). The memory store is global, so no
 * imports are needed. Degrades to a static fallback table on any failure.
 */
@Module({
  controllers: [CurrencyController],
  providers: [CurrencyService],
  // Exported so the expense ledger can price a foreign-currency entry with
  // the same rates the display converter uses.
  exports: [CurrencyService],
})
export class CurrencyModule {}
