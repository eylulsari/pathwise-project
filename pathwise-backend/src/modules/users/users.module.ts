import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './application/users.service';
import { UsersController } from './infrastructure/http/users.controller';
import { UserOrmEntity } from './infrastructure/persistence/user.orm-entity';
import { TypeOrmUserRepository } from './infrastructure/persistence/typeorm-user.repository';
import { USER_REPOSITORY } from './domain/user.repository.port';

@Module({
  imports: [TypeOrmModule.forFeature([UserOrmEntity])],
  controllers: [UsersController],
  providers: [
    UsersService,
    // Bind the port to its TypeORM adapter.
    { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },
  ],
  // Export the service so AuthModule can create/lookup users.
  exports: [UsersService],
})
export class UsersModule {}
