import { Controller, Post, Delete, Get, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard, CurrentUser } from '../../common/decorators';
import { User } from '../users/schemas/user.schema';

@ApiTags('Favorites')
@Controller('favorites')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post('toggle')
  @ApiOperation({ summary: 'Toggle favorite on a product or vendor' })
  toggle(
    @CurrentUser() user: User,
    @Body() body: { productId?: string; vendorId?: string },
  ) {
    return this.favoritesService.toggleFavorite(
      (user._id as unknown) as string,
      body.productId,
      body.vendorId,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get user favorites' })
  getUserFavorites(@CurrentUser() user: User) {
    return this.favoritesService.getUserFavorites((user._id as unknown) as string);
  }

  @Get(':productId/check')
  @ApiOperation({ summary: 'Check if product is favorite' })
  isFavorite(@CurrentUser() user: User, @Param('productId') productId: string) {
    return this.favoritesService.isFavorite((user._id as unknown) as string, productId);
  }

  @Post(':productId/remove')
  @ApiOperation({ summary: 'Remove product from favorites' })
  removeFavorite(@CurrentUser() user: User, @Param('productId') productId: string) {
    return this.favoritesService.removeFavorite((user._id as unknown) as string, productId);
  }
}
