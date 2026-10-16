import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { OptionalJwtAuthGuard } from '../../common/decorators';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  // The campus resolver reads req.user BEFORE the X-Institution-Id header, so a
  // route that accepts a token MUST populate req.user or a pinned user could be
  // scoped to another campus just by sending that campus's header.
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  async search(
    @Query('q') q: string,
    @Query('location') location?: string,
    @Query('time') time?: string,
    @Req() req?: any,
  ) {
    return this.searchService.globalSearch(q || '', location, time, req);
  }
}
