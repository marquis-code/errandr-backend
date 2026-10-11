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
  @ApiOperation({ summary: 'Generate a meal plan based on budget (POST)' })
  generatePlan(
    @Body() body: { budget: number; mealsPerDay?: number; preferences?: string[]; }
  ) {
    return this.mealPlannerService.generateMealPlan(
      body.budget,
      body.mealsPerDay || 3,
      body.preferences,
    );
  }

  @Post('iterations')
  @ApiOperation({ summary: 'Generate multiple meal plan iterations' })
  generateIterations(
    @Body() body: { 
      budget?: number; 
      dailyBudget?: number;
      bufferAmount?: number;
      mealsPerDay?: number; 
      vendors?: string[];
      dislikes?: string[];
      medicalConditions?: string[];
      allowCustomErrands?: boolean;
      includeDrinks?: boolean;
      count?: number;
    }
  ) {
    return this.mealPlannerService.generateIterations(body);
  }

  @Get('items')
  @ApiOperation({ summary: 'Get available meal options from vendors' })
  getAvailableMealOptions(@Query('vendors') vendors?: string | string[]) {
    const list = Array.isArray(vendors) ? vendors : (vendors ? [vendors] : undefined);
    return this.mealPlannerService.getAvailableMealOptions(list);
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
