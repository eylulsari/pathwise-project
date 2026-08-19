import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpensesService } from './application/expenses.service';
import { ExpensesController } from './infrastructure/http/expenses.controller';
import { ExpenseOrmEntity } from './infrastructure/persistence/expense.orm-entity';
import { CurrencyModule } from '../currency/currency.module';
import { MessagingModule } from '../messaging/messaging.module';
import { UsersModule } from '../users/users.module';

/**
 * Trip expenses and who owes whom.
 *
 * MessagingModule is imported for one thing: the accepted-connection check.
 * The consent rule that governs who you may message is the same rule that
 * governs whose name you may attach to a debt, and reimplementing it here
 * would give it a second definition to drift from.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ExpenseOrmEntity]),
    CurrencyModule,
    MessagingModule,
    UsersModule,
  ],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
