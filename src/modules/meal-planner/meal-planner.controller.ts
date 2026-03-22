import { Controller, Get, Post, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { MealPlannerService } from './meal-planner.service';
import { JwtAuthGuard } from '../../common/decorators';

@ApiTags('Meal Planner')
@Controller('meal-planner')
export class MealPlannerController {
  constructor(private readonly mealPlannerService: MealPlannerService) {}

  @Get()
  @ApiOperation({ summary: 'Generate a meal plan based on budget (GET)' })
  @ApiQuery({ name: 'budget', required: true, type: Number })
  @ApiQuery({ name: 'mealsPerDay', required: false, type: Number })
  @ApiQuery({ name: 'preferences', required: false, isArray: true, type: String })
  generatePlanGet(
    @Query('budget') budget: string,
    @Query('mealsPerDay') mealsPerDay?: string,
    @Query('preferences') preferences?: string | string[],
  ) {
    return this.mealPlannerService.generateMealPlan(
      Number(budget),
      mealsPerDay ? Number(mealsPerDay) : 3,
      Array.isArray(preferences) ? preferences : preferences ? [preferences] : undefined,
    );
  }

  @Post('generate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate a meal plan based on budget (POST)' })
  generatePlan(
    @Body()
    body: {
      budget: number;
      mealsPerDay?: number;
      preferences?: string[];
    },
  ): Promise<import('./meal-planner.service').MealPlan> {
    return this.mealPlannerService.generateMealPlan(
      body.budget,
      body.mealsPerDay || 3,
      body.preferences,
    );
  }

  @Get('suggest')
  @ApiOperation({ summary: 'Quick product suggestions by budget' })
  @ApiQuery({ name: 'budget', required: true, type: Number })
  suggestByBudget(@Query('budget') budget: string) {
    return this.mealPlannerService.suggestByBudget(Number(budget));
  }

  @Get('popular-combos')
  @ApiOperation({ summary: 'Get popular meal combinations' })
  getPopularCombos(@Query('limit') limit?: string) {
    return this.mealPlannerService.getPopularMealCombinations(
      limit ? Number(limit) : 10,
    );
  }
}
