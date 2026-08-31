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
  async getProfile(@CurrentUser() user: User) {
    try {
      // 5-second strict timeout to prevent frontend (canceled) requests
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('DB Timeout')), 5000));
      const profile = await Promise.race([
        this.errandersService.getProfile((user._id as unknown) as string),
        timeout
      ]);
      // console.log('--- GET /erranders/me OUTPUT ---', JSON.stringify(profile, null, 2));
      return profile;
    } catch (error) {
      console.error('--- GET /erranders/me FAILED, RETURNING FALLBACK ---', error.message);
      // Return safe fallback data so the frontend doesn't crash
      return {
        _id: user._id,
        user: user,
        status: 'offline',
        currentLocation: { type: 'Point', coordinates: [0, 0] },
        totalDeliveries: 0,
        totalEarnings: 0,
        rating: 5,
        isVerified: false,
        verificationLevel: 0, // CRITICAL for frontend conditional rendering
        vehicle: { type: 'Bicycle' }
      };
    }
  }

  @Post('verify/submit-tier-2')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit Tier 2 Verification' })
  submitTier2Verification(@CurrentUser() user: User, @Body() body: { idCardImage: string; selfieImage: string; ninSlipImage?: string; ninNumber?: string; whatsappNumber?: string; school?: string; matricNumber?: string }) {
    // Fire and forget: don't await so the slow DB/Email network doesn't cause a frontend timeout
    this.errandersService.submitTier2Verification((user._id as unknown) as string, body)
      .catch(err => console.error('Background Tier 2 Verification Error:', err.message));
    
    return { success: true, message: 'Verification submitted' };
  }

  @Post('verify/submit-tier-3')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit Tier 3 Verification' })
  submitTier3Verification(@CurrentUser() user: User, @Body() body: { guarantorDetails: any }) {
    // Fire and forget
    this.errandersService.submitTier3Verification((user._id as unknown) as string, body)
      .catch(err => console.error('Background Tier 3 Verification Error:', err.message));
      
    return { success: true, message: 'Guarantor details submitted' };
  }

  @Get('earnings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get errander earnings' })
  async getEarnings(@CurrentUser() user: User) {
    try {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('DB Timeout')), 5000));
      const earnings = await Promise.race([
        this.errandersService.getEarnings((user._id as unknown) as string),
        timeout
      ]);
      // console.log('--- GET /erranders/earnings OUTPUT ---', JSON.stringify(earnings, null, 2));
      return earnings;
    } catch (error) {
      console.error('--- GET /erranders/earnings FAILED, RETURNING FALLBACK ---', error.message);
      return {
        totalDeliveries: 0,
        totalEarnings: 0,
        rating: 5,
      };
    }
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
