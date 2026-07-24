import { Controller, Get, Query } from '@nestjs/common';
import { PlacesService } from '../../application/places.service';
import { Hub } from '../../domain/place';

@Controller('places')
export class PlacesController {
  constructor(private readonly places: PlacesService) {}

  /** GET /api/places  — optionally ?hub=<hub> */
  @Get()
  list(@Query('hub') hub?: Hub) {
    return hub ? this.places.findByHub(hub) : this.places.findAll();
  }
}
