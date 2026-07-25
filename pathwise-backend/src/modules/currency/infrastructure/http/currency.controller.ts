import { Controller, Get } from '@nestjs/common';
import { CurrencyService, CurrencyRates } from '../../application/currency.service';

@Controller('currency')
export class CurrencyController {
  constructor(private readonly currency: CurrencyService) {}

  /** Live TRY→{USD,EUR,GBP} rates for the display-currency converter. */
  @Get('rates')
  getRates(): Promise<CurrencyRates> {
    return this.currency.getRates();
  }
}
