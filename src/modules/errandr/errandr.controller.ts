import { Controller, Get, Post, Put, Body, UseGuards, Query, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ErrandrService } from './errandr.service';
import { JwtAuthGuard, CurrentUser, Roles, RolesGuard } from '../../common/decorators';
import { User, UserRole } from '../users/schemas/user.schema';

@ApiTags('Errandr')
@Controller('errandr')
export class ErrandrController {
  constructor(private readonly errandrService: ErrandrService) {}

  @Post('register')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register as errander' })
  register(@CurrentUser() user: User, @Body() body: any) {
    return this.errandrService.register((user._id as unknown) as string, body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get errander profile' })
  getProfile(@CurrentUser() user: User) {
    return this.errandrService.getProfile((user._id as unknown) as string);
  }

  @Get('earnings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get errander earnings' })
  getEarnings(@CurrentUser() user: User) {
    return this.errandrService.getEarnings((user._id as unknown) as string);
  }

  @Put('location')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update errander location' })
  updateLocation(@CurrentUser() user: User, @Body() body: { coordinates: number[] }) {
    return this.errandrService.updateLocation((user._id as unknown) as string, body.coordinates);
  }

  @Put('toggle-status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle errander availability' })
  toggleStatus(@CurrentUser() user: User) {
    return this.errandrService.toggleStatus((user._id as unknown) as string);
  }

  @Get('available')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get available errandr' })
  getAvailable() {
    return this.errandrService.getAvailable();
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all errandr (admin)' })
  getAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ) {
    return this.errandrService.getAll(page, limit);
  }
}
