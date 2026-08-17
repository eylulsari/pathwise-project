import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlacesModule } from '../places/places.module';
import { SavedPlacesService } from './application/saved-places.service';
import { SavedPlacesController } from './infrastructure/http/saved-places.controller';
import { SavedPlaceOrmEntity } from './infrastructure/persistence/saved-place.orm-entity';
import { TypeOrmSavedPlaceRepository } from './infrastructure/persistence/typeorm-saved-place.repository';
import { SAVED_PLACE_REPOSITORY } from './domain/saved-place.repository.port';

@Module({
  imports: [TypeOrmModule.forFeature([SavedPlaceOrmEntity]), PlacesModule],
  controllers: [SavedPlacesController],
  providers: [
    SavedPlacesService,
    { provide: SAVED_PLACE_REPOSITORY, useClass: TypeOrmSavedPlaceRepository },
  ],
  exports: [SavedPlacesService],
})
export class SavedPlacesModule {}
