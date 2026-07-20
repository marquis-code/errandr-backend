import { Controller, Get, Post, Put, Body, UseGuards, Query, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ErrandersService } from './erranders.service';
import { JwtAuthGuard, CurrentUser, Roles, RolesGuard } from '../../common/decorators';
import { User, UserRole } from '../users/schemas/user.schema';

@ApiTags('Erranders')
@Controller(['erranders', 'errandr'])
export class ErrandersController {
  constructor(private readonly errandersService: ErrandersService) {}

  @Post('register')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register as errander' })
  register(@CurrentUser() user: User, @Body() body: any) {
    return this.errandersService.register((user._id as unknown) as string, body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get errander profile' })
  getProfile(@CurrentUser() user: User) {
    return this.errandersService.getProfile((user._id as unknown) as string);
  }

  @Post('verify/submit-tier-2')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit Tier 2 Verification' })
  submitTier2Verification(@CurrentUser() user: User, @Body() body: { idCardImage: string; selfieImage: string; ninSlipImage?: string; ninNumber?: string; whatsappNumber?: string; school?: string; matricNumber?: string }) {
    return this.errandersService.submitTier2Verification((user._id as unknown) as string, body);
  }

  @Post('verify/submit-tier-3')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit Tier 3 Verification' })
  submitTier3Verification(@CurrentUser() user: User, @Body() body: { guarantorDetails: any }) {
    return this.errandersService.submitTier3Verification((user._id as unknown) as string, body);
  }

  @Get('earnings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get errander earnings' })
  getEarnings(@CurrentUser() user: User) {
    return this.errandersService.getEarnings((user._id as unknown) as string);
  }

  @Put('location')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update errander location' })
  updateLocation(@CurrentUser() user: User, @Body() body: { coordinates: number[] }) {
    return this.errandersService.updateLocation((user._id as unknown) as string, body.coordinates);
  }

  @Put('toggle-status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle errander availability' })
  toggleStatus(@CurrentUser() user: User) {
    return this.errandersService.toggleStatus((user._id as unknown) as string);
  }

  @Get('available')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get available erranders' })
  getAvailable() {
    return this.errandersService.getAvailable();
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all erranders (admin)' })
  getAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ) {
    return this.errandersService.getAll(page, limit);
  }
}
