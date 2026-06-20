import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async search(
    @Query('q') q: string,
    @Query('location') location?: string,
    @Query('time') time?: string,
  ) {
    return this.searchService.globalSearch(q || '', location, time);
  }
}
