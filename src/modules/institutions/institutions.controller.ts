import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InstitutionsService } from './institutions.service';
import { Institution } from './schemas/institution.schema';
import { JwtAuthGuard, Roles, RolesGuard } from '../../common/decorators';
import { UserRole } from '../users/schemas/user.schema';

@ApiTags('Institutions')
@Controller('institutions')
export class InstitutionsController {
  constructor(private readonly institutionsService: InstitutionsService) {}

  @Get()
  @ApiOperation({ summary: 'List active campuses for the picker' })
  findAll() {
    // Public on purpose: the picker is shown before a user signs up.
    return this.institutionsService.findAll(true);
  }

  @Get(':idOrSlug/stats')
  @ApiOperation({ summary: 'Light vendor/service counts for one campus' })
  getStats(@Param('idOrSlug') idOrSlug: string) {
    return this.institutionsService.getStats(idOrSlug);
  }

  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Get one campus by id or slug' })
  findOne(@Param('idOrSlug') idOrSlug: string) {
    return this.institutionsService.findByIdOrSlug(idOrSlug);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a campus (admin only)' })
  create(@Body() data: Partial<Institution>) {
    return this.institutionsService.create(data);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a campus (admin only)' })
  update(@Param('id') id: string, @Body() data: Partial<Institution>) {
    return this.institutionsService.update(id, data);
  }
}
