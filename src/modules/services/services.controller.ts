import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { JwtAuthGuard, CurrentUser, OptionalJwtAuthGuard } from '../../common/decorators';

@ApiTags('Services')
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new service' })
  create(@CurrentUser() user: any, @Body() body: any) {
    return this.servicesService.createForOwner((user._id as unknown) as string, body);
  }

  // The campus resolver reads req.user BEFORE the X-Institution-Id header, so a
  // route that accepts a token MUST populate req.user or a pinned user could be
  // scoped to another campus just by sending that campus's header.
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'List services' })
  findAll(@Query() query: any, @Req() req?: any) {
    return this.servicesService.findAll(query, req);
  }

  // The campus resolver reads req.user BEFORE the X-Institution-Id header, so a
  // route that accepts a token MUST populate req.user or a pinned user could be
  // scoped to another campus just by sending that campus's header.
  @UseGuards(OptionalJwtAuthGuard)
  @Get('vendor/:vendorId')
  @ApiOperation({ summary: 'Get services for a specific vendor' })
  findByVendor(@Param('vendorId') vendorId: string, @Query() query: any, @Req() req?: any) {
    return this.servicesService.findAll({ ...query, vendor: vendorId }, req);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get services for the current vendor' })
  findMine(@CurrentUser() user: any, @Query() query: any) {
    return this.servicesService.findByOwner((user._id as unknown) as string, query);
  }

  // The campus resolver reads req.user BEFORE the X-Institution-Id header, so a
  // route that accepts a token MUST populate req.user or a pinned user could be
  // scoped to another campus just by sending that campus's header.
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Get service by ID' })
  findById(@Param('id') id: string, @Req() req?: any) {
    return this.servicesService.findById(id, req);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a service' })
  update(@Param('id') id: string, @CurrentUser() user: any, @Body() body: any) {
    return this.servicesService.updateForOwner(id, (user._id as unknown) as string, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a service' })
  delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.servicesService.deleteForOwner(id, (user._id as unknown) as string);
  }

  @Put(':id/toggle')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle service availability' })
  toggleAvailability(@Param('id') id: string, @CurrentUser() user: any) {
    return this.servicesService.toggleAvailabilityForOwner(id, (user._id as unknown) as string);
  }
}
