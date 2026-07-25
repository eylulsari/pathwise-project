import { Module } from '@nestjs/common';
import { CurrencyService } from './application/currency.service';
import { CurrencyController } from './infrastructure/http/currency.controller';

/**
 * Live exchange rates via Frankfurter (free, key-less). Redis is global, so no
 * imports are needed. Degrades to a static fallback table on any failure.
 */
@Module({
  controllers: [CurrencyController],
  providers: [CurrencyService],
})
export class CurrencyModule {}
