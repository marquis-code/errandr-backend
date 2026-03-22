import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product } from '../products/schemas/product.schema';
import { Vendor } from '../vendors/schemas/vendor.schema';

export interface MealOption {
  product: any;
  vendor: any;
  price: number;
  category: string;
  nutritionalCategory: string;
}

export interface MealPlan {
  budget: number;
  mealsPerDay: number;
  totalDays: number;
  totalMeals: number;
  amountPerMeal: number;
  cookedMealPlan: DailyPlan[];
  rawMaterialsPlan: RawMaterialsPlan;
  savings: number;
  recommendation: string;
}

export interface DailyPlan {
  day: number;
  meals: {
    type: string; // breakfast, lunch, dinner
    options: MealOption[];
    estimatedCost: number;
  }[];
  dailyCost: number;
}

export interface RawMaterialsPlan {
  totalCost: number;
  daysSupported: number;
  items: {
    name: string;
    vendor: any;
    price: number;
    serves: number;
    category: string;
  }[];
  costPerDay: number;
  savingsVsCooked: number;
}

@Injectable()
export class MealPlannerService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(Vendor.name) private vendorModel: Model<Vendor>,
  ) {}

  private classifyNutrition(category: string, name: string): string {
    const lower = (category + ' ' + name).toLowerCase();
    if (/rice|bread|yam|pasta|garri|fufu|amala|semo|tuwo|pounded/i.test(lower)) return 'carbs';
    if (/chicken|beef|fish|egg|meat|goat|turkey|prawn|suya|kilishi|bean/i.test(lower)) return 'protein';
    if (/salad|vegetable|fruit|juice|smoothie|tomato|pepper|onion/i.test(lower)) return 'vegetables';
    if (/water|drink|zobo|kunu|fura|milk|yogurt/i.test(lower)) return 'drinks';
    if (/cake|chin-chin|puff-puff|donut|snack|biscuit|plantain/i.test(lower)) return 'snacks';
    return 'others';
  }

  async generateMealPlan(
    budget: number,
    mealsPerDay: number = 3,
    preferences?: string[],
  ): Promise<MealPlan> {
    // Get all available products from online vendors
    const onlineVendors = await this.vendorModel.find({
      isOnline: true,
      status: 'approved',
    }).select('_id storeName logo category isInsideCampus');

    const vendorIds = onlineVendors.map((v) => v._id);

    const products = await this.productModel
      .find({
        vendor: { $in: vendorIds },
        isAvailable: true,
      })
      .populate('vendor', 'storeName logo category isInsideCampus')
      .sort({ price: 1 });

    // Classify products by nutritional category
    const classified: MealOption[] = products.map((p) => ({
      product: {
        _id: p._id,
        name: p.name,
        price: p.price,
        image: (p as any).image,
        description: p.description,
      },
      vendor: p.vendor,
      price: p.price,
      category: p.category,
      nutritionalCategory: this.classifyNutrition(p.category, p.name),
    }));

    // Separate cooked food from raw materials
    const cookedOptions = classified.filter(
      (m) => !['groceries', 'raw_materials'].includes(m.category),
    );
    const rawOptions = classified.filter(
      (m) => ['groceries', 'raw_materials'].includes(m.category),
    );

    // --- COOKED FOOD PLAN ---
    const amountPerMeal = Math.floor(budget / (mealsPerDay * 7)); // 7 days target
    const cookedMealPlan = this.buildCookedPlan(
      cookedOptions,
      budget,
      mealsPerDay,
      amountPerMeal,
    );

    // --- RAW MATERIALS PLAN ---
    const rawMaterialsPlan = this.buildRawMaterialsPlan(rawOptions, budget);

    const cookedTotalDays = cookedMealPlan.length;
    const rawTotalDays = rawMaterialsPlan.daysSupported;

    const totalDays = Math.max(cookedTotalDays, rawTotalDays);
    const totalMeals = cookedTotalDays * mealsPerDay;

    const cookedDailyCost = cookedMealPlan.length > 0
      ? cookedMealPlan.reduce((s, d) => s + d.dailyCost, 0) / cookedMealPlan.length
      : 0;

    const savings = rawMaterialsPlan.savingsVsCooked;

    let recommendation = 'Based on your budget, ';
    if (rawTotalDays > cookedTotalDays * 1.5) {
      recommendation += `buying raw materials and cooking will sustain you ${rawTotalDays} days vs ${cookedTotalDays} days ordering cooked food — saving you ₦${savings.toLocaleString()}. We recommend a mix of both.`;
    } else {
      recommendation += `ordering cooked food from campus vendors is convenient and your ₦${budget.toLocaleString()} budget covers roughly ${cookedTotalDays} days at ${mealsPerDay} meals/day.`;
    }

    return {
      budget,
      mealsPerDay,
      totalDays: cookedTotalDays,
      totalMeals,
      amountPerMeal,
      cookedMealPlan,
      rawMaterialsPlan,
      savings,
      recommendation,
    };
  }

  private buildCookedPlan(
    options: MealOption[],
    budget: number,
    mealsPerDay: number,
    targetPerMeal: number,
  ): DailyPlan[] {
    const days: DailyPlan[] = [];
    let remaining = budget;
    const mealTypes = ['breakfast', 'lunch', 'dinner'].slice(0, mealsPerDay);

    // Group options by nutritional category
    const byCategory: Record<string, MealOption[]> = {};
    for (const opt of options) {
      if (!byCategory[opt.nutritionalCategory]) {
        byCategory[opt.nutritionalCategory] = [];
      }
      byCategory[opt.nutritionalCategory].push(opt);
    }

    // Build up to 14 days
    for (let day = 1; day <= 14 && remaining > 0; day++) {
      const meals: DailyPlan['meals'] = [];
      let dailyCost = 0;

      for (const mealType of mealTypes) {
        // For each meal, try to include a balanced option
        const mealOptions: MealOption[] = [];
        let mealCost = 0;

        // Try to pick one from each nutritional category within budget
        for (const cat of ['carbs', 'protein', 'vegetables']) {
          const catOptions = (byCategory[cat] || []).filter(
            (o) => o.price <= targetPerMeal * 0.6 && o.price <= remaining - mealCost,
          );
          if (catOptions.length > 0) {
            // Rotate options so different days get different meals
            const pick = catOptions[(day + mealType.length) % catOptions.length];
            mealOptions.push(pick);
            mealCost += pick.price;
          }
        }

        // If we couldn't build a balanced meal, just pick the cheapest available
        if (mealOptions.length === 0) {
          const affordable = options.filter((o) => o.price <= remaining);
          if (affordable.length > 0) {
            const pick = affordable[day % affordable.length];
            mealOptions.push(pick);
            mealCost = pick.price;
          }
        }

        if (mealCost > 0 && mealCost <= remaining) {
          meals.push({
            type: mealType,
            options: mealOptions,
            estimatedCost: mealCost,
          });
          dailyCost += mealCost;
          remaining -= mealCost;
        }
      }

      if (meals.length > 0) {
        days.push({ day, meals, dailyCost });
      } else {
        break;
      }
    }

    return days;
  }

  private buildRawMaterialsPlan(
    rawOptions: MealOption[],
    budget: number,
  ): RawMaterialsPlan {
    // Sort by price-to-serving ratio
    const items: RawMaterialsPlan['items'] = [];
    let totalCost = 0;

    // Pick staples first (carbs), then proteins, then vegetables
    const priorities = ['carbs', 'protein', 'vegetables', 'others'];

    for (const priority of priorities) {
      const categoryItems = rawOptions
        .filter((o) => o.nutritionalCategory === priority)
        .sort((a, b) => a.price - b.price);

      for (const item of categoryItems) {
        if (totalCost + item.price <= budget * 0.9) {
          // Estimate servings: cheaper items typically yield more servings
          const serves = Math.max(1, Math.round(5000 / item.price));
          items.push({
            name: item.product.name,
            vendor: item.vendor,
            price: item.price,
            serves,
            category: item.nutritionalCategory,
          });
          totalCost += item.price;
        }
      }
    }

    const totalServings = items.reduce((s, i) => s + i.serves, 0);
    const daysSupported = Math.floor(totalServings / 3); // 3 meals per day
    const costPerDay = daysSupported > 0 ? Math.round(totalCost / daysSupported) : 0;

    // Calculate cooked food average cost per day for comparison
    const cookedDailyCost = budget / 7; // assume 7 days target
    const savingsVsCooked = Math.round(
      (cookedDailyCost - costPerDay) * daysSupported,
    );

    return {
      totalCost,
      daysSupported,
      items,
      costPerDay,
      savingsVsCooked: Math.max(0, savingsVsCooked),
    };
  }

  async getPopularMealCombinations(limit: number = 10) {
    // Aggregate most ordered combinations from orders
    const products = await this.productModel
      .find({ isAvailable: true, orderCount: { $gt: 0 } })
      .populate('vendor', 'storeName logo')
      .sort({ orderCount: -1 })
      .limit(limit);

    return products;
  }

  async suggestByBudget(budget: number) {
    // Quick suggestion: return affordable products sorted by value
    const products = await this.productModel
      .find({
        isAvailable: true,
        price: { $lte: budget },
      })
      .populate('vendor', 'storeName logo isOnline')
      .sort({ price: 1 })
      .limit(20);

    return {
      budget,
      affordableCount: products.length,
      products,
    };
  }
}
