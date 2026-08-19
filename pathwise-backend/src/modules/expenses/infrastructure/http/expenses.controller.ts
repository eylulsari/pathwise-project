import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ExpensesService } from '../../application/expenses.service';
import { CreateExpenseDto } from '../../application/dto/create-expense.dto';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { AuthUser } from '../../../auth/domain/auth-user';

/**
 * The trip ledger. Whose it is always comes from the token, never from the
 * path or the body — an endpoint that took a userId would let one traveller
 * read, or write to, another's books.
 *
 * There is no endpoint here that pays anybody. See expenses.service.ts.
 */
@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  /** GET /api/expenses — the ledger: rows, totals, and who owes whom. */
  @Get()
  ledger(@CurrentUser() user: AuthUser) {
    return this.expenses.ledger(user.id);
  }

  @Post()
  add(@CurrentUser() user: AuthUser, @Body() dto: CreateExpenseDto) {
    return this.expenses.add(user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.expenses.remove(user.id, id);
  }
}
