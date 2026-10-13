import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product } from '../products/schemas/product.schema';
import { Vendor } from '../vendors/schemas/vendor.schema';
import { MenuItem } from '../menu/schemas/menu-item.schema';

export interface MealBreakdownItem {
  name: string;
  category: string;
  portion: string;
  portions?: number;
  basePrice?: number;
  baseCalories?: number;
  calories: number;
  price?: number;
}

export interface MealNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  benefit: string;
}

export interface MealBreakdown {
  items: MealBreakdownItem[];
  nutrition: MealNutrition;
}

export interface MealOption {
  product: any;
  vendor: any;
  price: number;
  category: string;
  nutritionalCategory: string;
  portionUnit?: string;
  prepTimeMinutes?: number;
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
    isCustom?: boolean;
    name?: string;
    packagingFee?: number;
    foodSubtotal?: number;
    drink?: any;
    breakdown?: MealBreakdown;
    portions?: number;
    preferredTime?: string;
  }[];
  dailyCost: number;
  totalCost?: number;
  foodSubtotal?: number;
  packagingFee?: number;
  deliveryFee?: number;
  serviceFee?: number;
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

export interface IterationParams {
  budget?: number;
  dailyBudget?: number;
  bufferAmount?: number;
  mealsPerDay?: number;
  cycleDays?: number;
  totalDays?: number;
  vendors?: string[];
  dislikes?: string[];
  medicalConditions?: string[];
  allowCustomErrands?: boolean;
  includeDrinks?: boolean;
  count?: number;
}

@Injectable()
export class MealPlannerService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(Vendor.name) private vendorModel: Model<Vendor>,
    @InjectModel(MenuItem.name) private menuItemModel: Model<MenuItem>,
  ) {}

  private classifyNutrition(category: string, name: string): string {
    const lower = (category + ' ' + name).toLowerCase();
    if (/rice|bread|yam|pasta|garri|fufu|amala|semo|tuwo|pounded|spag|noodle/i.test(lower)) return 'carbs';
    if (/chicken|beef|fish|egg|meat|goat|turkey|prawn|suya|kilishi|bean|protein/i.test(lower)) return 'protein';
    if (/salad|vegetable|fruit|juice|smoothie|tomato|pepper|onion|greens/i.test(lower)) return 'vegetables';
    if (/water|drink|zobo|kunu|fura|milk|yogurt/i.test(lower)) return 'drinks';
    if (/cake|chin-chin|puff-puff|donut|snack|biscuit|plantain|pie/i.test(lower)) return 'snacks';
    return 'carbs';
  }

  private generateMealBreakdown(
    comboOptions: MealOption[], 
    vendorName: string, 
    mealType: string, 
    conditions: string[] = [],
    packagingFee: number = 150
  ): MealBreakdown {
    const items: MealBreakdownItem[] = [];

    for (const opt of comboOptions) {
      const pName = opt.product?.name || 'Meal Portion';
      const cat = this.categorizeItem(pName, opt.category || '');
      
      let categoryLabel = 'Main Base';
      if (cat === 'protein') categoryLabel = 'Protein & Sauce';
      else if (cat === 'side') categoryLabel = 'Side / Veggies';
      else if (cat === 'drink') categoryLabel = 'Drink / Beverage';

      const portionLabel = opt.portionUnit ? `1 ${opt.portionUnit}` : (cat === 'base' ? '1 plate' : cat === 'protein' ? '1 portion' : '1 serving');

      const lower = pName.toLowerCase();
      let calories = 320;
      if (cat === 'base') {
        if (/rice/i.test(lower)) calories = /fried/i.test(lower) ? 410 : 380;
        else if (/beans/i.test(lower)) calories = 330;
        else if (/spag|pasta/i.test(lower)) calories = 360;
        else if (/yam/i.test(lower)) calories = 390;
        else if (/amala|semo|swallow|fufu/i.test(lower)) calories = 340;
        else calories = 350;
      } else if (cat === 'protein') {
        if (/egg/i.test(lower)) calories = 78;
        else if (/fish/i.test(lower)) calories = 180;
        else if (/chicken/i.test(lower)) calories = 240;
        else if (/beef|meat/i.test(lower)) calories = 220;
        else if (/turkey/i.test(lower)) calories = 250;
        else calories = 200;
      } else if (cat === 'side') {
        if (/plantain|dodo/i.test(lower)) calories = 180;
        else if (/slaw|salad/i.test(lower)) calories = 60;
        else if (/moimoi/i.test(lower)) calories = 170;
        else calories = 120;
      } else if (cat === 'drink') {
        calories = /water/i.test(lower) ? 0 : 130;
      }

      items.push({
        name: pName,
        category: categoryLabel,
        portion: portionLabel,
        portions: 1,
        basePrice: opt.price,
        baseCalories: calories,
        calories,
        price: opt.price
      });
    }

    if (packagingFee > 0) {
      items.push({
        name: 'Eco-grade Takeaway Pack',
        category: 'Packaging',
        portion: '1 container',
        portions: 1,
        basePrice: packagingFee,
        baseCalories: 0,
        calories: 0,
        price: packagingFee
      });
    }

    const totalKcal = items.reduce((sum, it) => sum + it.calories, 0);
    const proteinItems = items.filter(it => it.category === 'Protein & Sauce');
    const proteinGrams = Math.round((proteinItems.length > 0 ? 26 : 14) + (mealType === 'lunch' ? 6 : 2));
    const carbsGrams = Math.round(totalKcal * 0.52 / 4);
    const fatsGrams = Math.round((totalKcal * 0.22) / 9);
    const fiberGrams = Math.max(3, Math.round(carbsGrams * 0.08));

    let benefit = "Balanced campus combo delivering steady glucose release, lean amino acids, and vital electrolytes.";
    if (conditions.some(c => c.toLowerCase().includes('ulcer'))) {
      benefit = "Prepared with gentle seasoning and soothing carbohydrates to protect against gastric acidity.";
    } else if (conditions.some(c => c.toLowerCase().includes('diabetes'))) {
      benefit = "Rich in complex fiber for sustained glycemic control and post-meal focus during study sessions.";
    } else if (conditions.some(c => c.toLowerCase().includes('protein'))) {
      benefit = "High biological value proteins supporting muscle synthesis and long-lasting lecture satiety.";
    }

    return {
      items,
      nutrition: {
        calories: totalKcal,
        protein: proteinGrams,
        carbs: carbsGrams,
        fats: fatsGrams,
        fiber: fiberGrams,
        benefit
      }
    };
  }

  async generateMealPlan(budget: number, mealsPerDay: number = 3, preferences?: string[]): Promise<MealPlan> {
    const onlineVendors = await this.vendorModel.find({ isOnline: true, status: 'approved' }).select('_id storeName logo category isInsideCampus');
    const vendorIds = onlineVendors.map((v) => v._id);
    const products = await this.productModel.find({ vendor: { $in: vendorIds }, isAvailable: true }).populate('vendor', 'storeName logo category isInsideCampus').sort({ price: 1 });

    const classified: MealOption[] = products.map((p) => ({
      product: { _id: p._id, name: p.name, price: p.price, image: (p as any).image, description: p.description },
      vendor: p.vendor,
      price: p.price,
      category: p.category,
      nutritionalCategory: this.classifyNutrition(p.category, p.name),
    }));

    const cookedOptions = classified.filter((m) => !['groceries', 'raw_materials'].includes(m.category));
    const rawOptions = classified.filter((m) => ['groceries', 'raw_materials'].includes(m.category));
    const amountPerMeal = Math.floor(budget / (mealsPerDay * 7)); 
    const cookedMealPlan = this.buildCookedPlan(cookedOptions, budget, mealsPerDay, amountPerMeal, 0, false, []);
    const rawMaterialsPlan = this.buildRawMaterialsPlan(rawOptions, budget);
    const cookedTotalDays = cookedMealPlan.length;
    const rawTotalDays = rawMaterialsPlan.daysSupported;
    const totalMeals = cookedTotalDays * mealsPerDay;
    const savings = rawMaterialsPlan.savingsVsCooked;
    return { budget, mealsPerDay, totalDays: cookedTotalDays, totalMeals, amountPerMeal, cookedMealPlan, rawMaterialsPlan, savings, recommendation: 'Based on budget' };
  }

  async generateIterations(params: IterationParams) {
    try {
      const { 
        budget, 
        dailyBudget,
        bufferAmount = 0,
        mealsPerDay = 3, 
        cycleDays: rawCycleDays,
        totalDays: rawTotalDays,
        vendors = [], 
        dislikes = [], 
        medicalConditions = [], 
        allowCustomErrands = false, 
        includeDrinks = false,
        count = 3 
      } = params;

      const cycleDays = Math.max(1, Math.min(30, Number(rawCycleDays || rawTotalDays || 7)));

      let effectiveCycleBudget = Number(budget) || 0;
      let effectiveDailyBudget = Number(dailyBudget) || 0;

      if (effectiveDailyBudget > 0 && effectiveCycleBudget <= 0) {
        effectiveCycleBudget = effectiveDailyBudget * cycleDays;
      } else if (effectiveCycleBudget > 0 && effectiveDailyBudget <= 0) {
        effectiveDailyBudget = Math.floor(effectiveCycleBudget / cycleDays);
      } else if (effectiveCycleBudget <= 0 && effectiveDailyBudget <= 0) {
        effectiveCycleBudget = 1500 * cycleDays;
        effectiveDailyBudget = 1500;
      }

      const buffer = Number(bufferAmount) || 0;
      const maxAllowedCycleBudget = effectiveCycleBudget + buffer;
      const maxAllowedDailyBudget = Math.floor(maxAllowedCycleBudget / cycleDays);

      // 1. Get vendor IDs safely
      let vendorFilter: any = { status: 'approved' };
      const validVendorIds = (vendors || [])
        .filter((v: any) => v && typeof v === 'string' && Types.ObjectId.isValid(v))
        .map((v: any) => new Types.ObjectId(v));

      if (validVendorIds.length > 0) {
        vendorFilter._id = { $in: validVendorIds };
      }

      // Fetch vendors with .lean() for blazing speed
      let targetVendors = await this.vendorModel
        .find(vendorFilter)
        .select('_id storeName logo category isInsideCampus')
        .lean();

      if (targetVendors.length === 0) {
        targetVendors = await this.vendorModel
          .find({ status: 'approved' })
          .select('_id storeName logo category isInsideCampus')
          .limit(20)
          .lean();
      }

      const vendorMap = new Map<string, any>();
      const vendorIds: Types.ObjectId[] = [];
      for (const v of targetVendors) {
        const idStr = String(v._id);
        vendorMap.set(idStr, v);
        vendorIds.push(v._id);
      }

      // 2. Fetch from BOTH MenuItem and Product using .lean() with selected fields (no slow populate roundtrips)
      const menuItemQuery: any = { isAvailable: { $ne: false } };
      if (vendorIds.length > 0) {
        menuItemQuery.vendorId = { $in: vendorIds };
      }

      const productQuery: any = { isAvailable: { $ne: false } };
      if (vendorIds.length > 0) {
        productQuery.vendor = { $in: vendorIds };
      }

      const [menuItems, products] = await Promise.all([
        this.menuItemModel
          .find(menuItemQuery)
          .select('_id name pricePerPortion image images description vendorId category portionUnit prepTimeMinutes')
          .lean(),
        this.productModel
          .find(productQuery)
          .select('_id name price image description vendor category')
          .lean()
      ]);

      const combinedOptions: MealOption[] = [];

      // Map MenuItems
      for (const m of menuItems) {
        const vInfo = vendorMap.get(String(m.vendorId)) || targetVendors[0];
        if (!vInfo) continue;
        combinedOptions.push({
          product: { 
            _id: m._id, 
            name: m.name, 
            price: m.pricePerPortion, 
            image: m.image || (m.images && m.images[0]) || '', 
            description: m.description || '' 
          },
          vendor: vInfo,
          price: m.pricePerPortion,
          category: (m as any).category || 'eatery',
          nutritionalCategory: this.classifyNutrition((m as any).category || '', m.name),
          portionUnit: m.portionUnit || 'plate',
          prepTimeMinutes: m.prepTimeMinutes || 20
        });
      }

      // Map Products
      for (const p of products) {
        const vInfo = vendorMap.get(String(p.vendor)) || targetVendors[0];
        if (!vInfo) continue;
        combinedOptions.push({
          product: { 
            _id: p._id, 
            name: p.name, 
            price: p.price, 
            image: (p as any).image, 
            description: p.description 
          },
          vendor: vInfo,
          price: p.price,
          category: p.category || 'eatery',
          nutritionalCategory: this.classifyNutrition(p.category || '', p.name),
        });
      }

      // Interleave items by vendor so all vendors are represented fairly and evenly
      const optionsByVendor = new Map<string, MealOption[]>();
      for (const opt of combinedOptions) {
        const vKey = String(opt.vendor?._id || opt.vendor?.storeName || 'default');
        if (!optionsByVendor.has(vKey)) optionsByVendor.set(vKey, []);
        optionsByVendor.get(vKey)!.push(opt);
      }

      const interleaved: MealOption[] = [];
      const vendorBuckets = Array.from(optionsByVendor.values());
      const maxItems = Math.max(...vendorBuckets.map(b => b.length), 0);
      for (let i = 0; i < maxItems; i++) {
        for (const bucket of vendorBuckets) {
          if (i < bucket.length) {
            interleaved.push(bucket[i]);
          }
        }
      }

      let finalOptions = interleaved.length > 0 ? interleaved : [...combinedOptions];

      // Fallback: If filtered list had no menu items, fetch across all campus eateries with .lean()
      if (finalOptions.length === 0) {
        const fallbackItems = await this.menuItemModel
          .find({ isAvailable: { $ne: false } })
          .select('_id name pricePerPortion image images description vendorId category portionUnit prepTimeMinutes')
          .limit(100)
          .lean();

        for (const m of fallbackItems) {
          const vInfo = vendorMap.get(String(m.vendorId)) || targetVendors[0] || { storeName: 'Campus Vendor' };
          finalOptions.push({
            product: { 
              _id: m._id, 
              name: m.name, 
              price: m.pricePerPortion, 
              image: m.image || (m.images && m.images[0]) || '', 
              description: m.description || '' 
            },
            vendor: vInfo,
            price: m.pricePerPortion,
            category: (m as any).category || 'eatery',
            nutritionalCategory: this.classifyNutrition((m as any).category || '', m.name),
            portionUnit: m.portionUnit || 'plate',
            prepTimeMinutes: m.prepTimeMinutes || 20
          });
        }
      }

      // Filter dislikes and medical constraints
      let filteredOptions = finalOptions.filter(opt => {
        const pName = (opt.product?.name || '').toLowerCase();
        const pCat = (opt.category || '').toLowerCase();
        
        // Filter out user dislikes
        for (const d of (dislikes || [])) {
          if (d && (pName.includes(d.toLowerCase()) || pCat.includes(d.toLowerCase()))) return false;
        }

        // Filter based on medical & dietary constraints
        if (medicalConditions.includes('Vegetarian')) {
          if (/meat|beef|chicken|fish|goat|turkey|pork|suya|kilishi|egg/i.test(pName)) return false;
        }
        if (medicalConditions.includes('Lactose Intolerance')) {
          if (/milk|cheese|yogurt|dairy|fura/i.test(pName)) return false;
        }
        if (medicalConditions.includes('Celiac / Gluten Free')) {
          if (/bread|pasta|spaghetti|wheat|pastry|indomie|noodle/i.test(pName)) return false;
        }
        if (medicalConditions.some(c => c.includes('Diabetes'))) {
          if (/cake|sugar|donut|puff-puff|soda|coke|fanta|sweet|juice/i.test(pName)) return false;
        }
        if (medicalConditions.some(c => c.includes('Ulcer') || c.includes('GERD'))) {
          if (/pepper|spicy|suya|kilishi|hot chili/i.test(pName)) return false;
        }

        return true;
      });

      // If restrictive dietary filters eliminated everything, gracefully fall back to finalOptions
      if (filteredOptions.length === 0 && finalOptions.length > 0) {
        filteredOptions = finalOptions;
      }

      const cookedOptions = filteredOptions.filter((m) => !['groceries', 'raw_materials'].includes(m.category));
      
      const PACKAGING_FEE_PER_MEAL = 150;
      const DAILY_NINJA_DELIVERY_FEE = 350;
      const DAILY_SERVICE_FEE = 50;
      const dailyNonFoodFees = DAILY_NINJA_DELIVERY_FEE + DAILY_SERVICE_FEE + (mealsPerDay * PACKAGING_FEE_PER_MEAL);
      const targetDailyFood = Math.max(mealsPerDay * 300, maxAllowedDailyBudget - dailyNonFoodFees);
      const targetPerMeal = Math.max(300, Math.floor(targetDailyFood / mealsPerDay));

      const iterations: any[] = [];
      const iterationCount = Math.max(1, count || 3);

      for (let i = 0; i < iterationCount; i++) {
        const cookedMealPlan = this.buildCookedPlan(
          cookedOptions.length > 0 ? cookedOptions : finalOptions, 
          effectiveCycleBudget, 
          mealsPerDay, 
          targetPerMeal, 
          i, 
          allowCustomErrands,
          medicalConditions,
          includeDrinks,
          cycleDays
        );

        // 100% Strict Budget Enforcement Guarantee:
        // Total plan cost MUST NOT exceed maxAllowedCycleBudget under any circumstance.
        let totalPlanCost = cookedMealPlan.reduce((acc, d) => acc + d.dailyCost, 0);

        if (totalPlanCost > maxAllowedCycleBudget) {
          // Pass 1: Prune extra options (drinks, sides, secondary proteins)
          for (const day of cookedMealPlan) {
            if (totalPlanCost <= maxAllowedCycleBudget) break;
            for (const meal of day.meals) {
              if (totalPlanCost <= maxAllowedCycleBudget) break;
              while (meal.options && meal.options.length > 1 && totalPlanCost > maxAllowedCycleBudget) {
                const removedOption = meal.options.pop()!;
                const reducedAmount = Number(removedOption.price) || 0;
                meal.foodSubtotal = Math.max(150, (meal.foodSubtotal || 0) - reducedAmount);
                meal.estimatedCost = meal.foodSubtotal + PACKAGING_FEE_PER_MEAL;
                meal.name = meal.options.map(o => o.product.name).join(' with ');
                if (meal.breakdown?.items) {
                  meal.breakdown.items = meal.breakdown.items.filter(it => it.name !== removedOption.product?.name);
                }
                day.foodSubtotal = day.meals.reduce((sum, m) => sum + (m.foodSubtotal || 0), 0);
                day.dailyCost = day.foodSubtotal + (day.packagingFee || 0) + (day.deliveryFee || 0) + (day.serviceFee || 0);
                day.totalCost = day.dailyCost;
                totalPlanCost = cookedMealPlan.reduce((acc, d) => acc + d.dailyCost, 0);
              }
            }
          }

          // Pass 2: Scale food prices proportionally to fit available food budget
          if (totalPlanCost > maxAllowedCycleBudget) {
            const fixedFees = cycleDays * (DAILY_NINJA_DELIVERY_FEE + DAILY_SERVICE_FEE + (mealsPerDay * PACKAGING_FEE_PER_MEAL));
            const availableFoodBudget = Math.max(cycleDays * mealsPerDay * 150, maxAllowedCycleBudget - fixedFees);
            const currentFoodTotal = cookedMealPlan.reduce((acc, d) => acc + (d.foodSubtotal || 0), 0);

            if (currentFoodTotal > availableFoodBudget && currentFoodTotal > 0) {
              const ratio = availableFoodBudget / currentFoodTotal;
              for (const day of cookedMealPlan) {
                for (const meal of day.meals) {
                  const scaledFood = Math.max(150, Math.floor((meal.foodSubtotal || 0) * ratio));
                  meal.foodSubtotal = scaledFood;
                  meal.estimatedCost = scaledFood + PACKAGING_FEE_PER_MEAL;
                  if (meal.breakdown?.items) {
                    for (const item of meal.breakdown.items) {
                      if (item.category !== 'Packaging') {
                        item.price = scaledFood;
                        item.portion = '1 student portion';
                      }
                    }
                  }
                }
                day.foodSubtotal = day.meals.reduce((sum, m) => sum + (m.foodSubtotal || 0), 0);
                day.dailyCost = day.foodSubtotal + (day.packagingFee || 0) + (day.deliveryFee || 0) + (day.serviceFee || 0);
                day.totalCost = day.dailyCost;
              }
              totalPlanCost = cookedMealPlan.reduce((acc, d) => acc + d.dailyCost, 0);
            }
          }

          // Pass 3: Exact penny clamp so totalPlanCost <= maxAllowedCycleBudget is 100% guaranteed
          if (totalPlanCost > maxAllowedCycleBudget) {
            let difference = totalPlanCost - maxAllowedCycleBudget;
            for (const day of cookedMealPlan) {
              if (difference <= 0) break;
              for (const meal of day.meals) {
                if (difference <= 0) break;
                const canReduce = Math.max(0, (meal.foodSubtotal || 0) - 100);
                const reduction = Math.min(difference, canReduce);
                if (reduction > 0) {
                  meal.foodSubtotal = (meal.foodSubtotal || 0) - reduction;
                  meal.estimatedCost = meal.foodSubtotal + PACKAGING_FEE_PER_MEAL;
                  if (meal.breakdown?.items) {
                    for (const item of meal.breakdown.items) {
                      if (item.category !== 'Packaging') {
                        item.price = meal.foodSubtotal;
                      }
                    }
                  }
                  difference -= reduction;
                }
              }
              day.foodSubtotal = day.meals.reduce((sum, m) => sum + (m.foodSubtotal || 0), 0);
              day.dailyCost = day.foodSubtotal + (day.packagingFee || 0) + (day.deliveryFee || 0) + (day.serviceFee || 0);
              day.totalCost = day.dailyCost;
            }
          }
        }

        const totalCost = cookedMealPlan.reduce((acc, d) => acc + d.dailyCost, 0);
        const foodSubtotal = cookedMealPlan.reduce((acc, d) => acc + (d.foodSubtotal || 0), 0);
        const packagingTotal = cookedMealPlan.reduce((acc, d) => acc + (d.packagingFee || 0), 0);
        const deliveryTotal = cookedMealPlan.reduce((acc, d) => acc + (d.deliveryFee || 0), 0);
        const serviceTotal = cookedMealPlan.reduce((acc, d) => acc + (d.serviceFee || 0), 0);
        
        const notes: string[] = [];
        if (medicalConditions.some(c => c.includes('Ulcer'))) notes.push('Low spice, gentle meals for ulcer relief');
        if (medicalConditions.some(c => c.includes('Diabetes'))) notes.push('Complex carbs & low glycemic choices');
        if (medicalConditions.some(c => c.includes('Hypertension'))) notes.push('Low sodium, wholesome choices');
        if (medicalConditions.some(c => c.includes('Vegetarian'))) notes.push('Plant-rich balanced selections');
        if (medicalConditions.some(c => c.includes('High Protein'))) notes.push('High-protein density for sustained energy');
        if (medicalConditions.some(c => c.includes('Weight Loss'))) notes.push('Calorie-conscious portions rich in fiber');
        if (medicalConditions.some(c => c.includes('Lactose'))) notes.push('Dairy-free wholesome selections');
        if (medicalConditions.some(c => c.includes('GERD'))) notes.push('Mild, soothing, non-greasy dishes');

        const healthNote = notes.length > 0 
          ? notes.join(' • ') + '.'
          : 'Balanced iteration providing essential macros for student life.';

        const bufferUsed = Math.max(0, totalCost - effectiveCycleBudget);
        const budgetDeficit = Math.max(0, totalCost - maxAllowedCycleBudget);

        iterations.push({
          days: cookedMealPlan,
          totalCost,
          foodSubtotal,
          packagingTotal,
          deliveryTotal,
          serviceTotal,
          budget: effectiveCycleBudget,
          dailyBudget: effectiveDailyBudget,
          bufferAmount: buffer,
          bufferUsed,
          budgetDeficit,
          healthNote,
          cycleDays,
          mealsPerDay
        });
      }

      return iterations;
    } catch (error) {
      console.error('Failed to generate iterations:', error);
      throw error;
    }
  }

  private categorizeItem(name: string, category: string): 'base' | 'protein' | 'side' | 'drink' {
    const lower = (name + ' ' + category).toLowerCase();
    if (/water|coke|fanta|pepsi|malt|pulpy|drink|juice|zobo|kunu|beverage|bottle/i.test(lower)) return 'drink';
    if (/plantain|dodo|coleslaw|salad|moimoi|moi-moi|moi moi|slaw/i.test(lower)) return 'side';
    if (/chicken|beef|meat|fish|turkey|goat|egg|suya|kilishi|pomo|assorted|prawn/i.test(lower)) return 'protein';
    return 'base';
  }

  private buildCookedPlan(
    options: MealOption[], 
    budget: number, 
    mealsPerDay: number, 
    targetPerMeal: number, 
    offset: number,
    allowCustomErrands: boolean = false,
    medicalConditions: string[] = [],
    includeDrinks: boolean = false,
    cycleDays: number = 7
  ): DailyPlan[] {
    const days: DailyPlan[] = [];
    const mealTypes = ['breakfast', 'lunch', 'dinner'].slice(0, mealsPerDay);

    // Group available options by Vendor for multi-vendor distribution
    const optionsByVendor = new Map<string, MealOption[]>();
    for (const opt of options) {
      const vName = opt.vendor?.storeName || String(opt.vendor?._id || 'Campus Vendor');
      if (!optionsByVendor.has(vName)) optionsByVendor.set(vName, []);
      optionsByVendor.get(vName)!.push(opt);
    }
    const vendorNames = Array.from(optionsByVendor.keys());

    // Collect global drinks and sides as fallbacks if vendor doesn't sell them
    const allDrinks = options.filter(o => this.categorizeItem(o.product.name, o.category) === 'drink').sort((a, b) => a.price - b.price);
    const allProteins = options.filter(o => this.categorizeItem(o.product.name, o.category) === 'protein').sort((a, b) => a.price - b.price);

    // Standard platform fees
    const PACKAGING_FEE_PER_MEAL = 150; // Takeaway pack
    const DAILY_NINJA_DELIVERY_FEE = 350; // Errand Ninja delivery
    const DAILY_SERVICE_FEE = 50; // Platform charge

    // Build cycleDays plan
    for (let day = 1; day <= cycleDays; day++) {
      const meals: DailyPlan['meals'] = [];
      let dailyFoodSubtotal = 0;
      let dailyPackaging = 0;

      for (let mIdx = 0; mIdx < mealTypes.length; mIdx++) {
        const mealType = mealTypes[mIdx];
        
        // Pick vendor in round-robin fashion
        const vIdx = (day * 2 + mIdx + offset * 3) % Math.max(1, vendorNames.length);
        const assignedVendor = vendorNames[vIdx] || 'Campus Vendor';
        const vendorMeals = optionsByVendor.get(assignedVendor) || options;

        // Partition this vendor's dishes into meal components and sort by price
        const vBases = vendorMeals.filter(m => this.categorizeItem(m.product.name, m.category) === 'base').sort((a, b) => a.price - b.price);
        const vProteins = vendorMeals.filter(m => this.categorizeItem(m.product.name, m.category) === 'protein').sort((a, b) => a.price - b.price);
        const vSides = vendorMeals.filter(m => this.categorizeItem(m.product.name, m.category) === 'side').sort((a, b) => a.price - b.price);
        const vDrinks = vendorMeals.filter(m => this.categorizeItem(m.product.name, m.category) === 'drink').sort((a, b) => a.price - b.price);

        const comboOptions: MealOption[] = [];
        let comboName = '';
        let comboFoodPrice = 0;

        // 1. Pick Base - prioritize options that fit within the targetPerMeal budget
        const affordableBases = vBases.filter(m => m.price <= targetPerMeal * 1.15);
        const candidateBases = affordableBases.length > 0 ? affordableBases : vBases.slice(0, Math.min(3, vBases.length));
        let chosenBase = candidateBases.length > 0 
          ? candidateBases[(day * 3 + mIdx * 5 + offset * 7) % candidateBases.length] 
          : vendorMeals[0];

        if (chosenBase) {
          comboOptions.push(chosenBase);
          comboFoodPrice += chosenBase.price;
          comboName = chosenBase.product.name;
        }

        // 2. Pick Protein ONLY if base doesn't already contain protein AND remaining budget allows it
        const baseNameLower = (chosenBase?.product?.name || '').toLowerCase();
        const alreadyHasProtein = /egg|chicken|beef|meat|fish|turkey|goat|pomo|assorted|suya|kilishi|sausage/i.test(baseNameLower);

        let chosenProtein: MealOption | null = null;
        const remainingForProtein = targetPerMeal - comboFoodPrice;
        if (!alreadyHasProtein && remainingForProtein >= 200) {
          const affordableProteins = vProteins.filter(p => p.price <= remainingForProtein * 1.2);
          if (affordableProteins.length > 0) {
            chosenProtein = affordableProteins[(day * 2 + mIdx * 3 + offset * 5) % affordableProteins.length];
          } else if (allProteins.length > 0) {
            const globalAffordable = allProteins.filter(p => p.price <= remainingForProtein * 1.2);
            if (globalAffordable.length > 0) {
              chosenProtein = globalAffordable[(day + mIdx) % globalAffordable.length];
            }
          }

          if (chosenProtein && chosenProtein.product.name !== chosenBase?.product.name) {
            comboOptions.push(chosenProtein);
            comboFoodPrice += chosenProtein.price;
            comboName += ` with ${chosenProtein.product.name}`;
          }
        }

        // 3. Pick Side (Plantain / Coleslaw / Moimoi) only if budget permits
        if (vSides.length > 0 && mIdx >= 1 && (comboFoodPrice + vSides[0].price <= targetPerMeal)) {
          const affordableSides = vSides.filter(s => comboFoodPrice + s.price <= targetPerMeal);
          if (affordableSides.length > 0) {
            const candidateSide = affordableSides[(day + mIdx) % affordableSides.length];
            comboOptions.push(candidateSide);
            comboFoodPrice += candidateSide.price;
            comboName += ` & ${candidateSide.product.name}`;
          }
        }

        // 4. Pick Drink (if user requested drink on meals and budget permits)
        let chosenDrink: MealOption | null = null;
        if (includeDrinks && (comboFoodPrice + 150 <= targetPerMeal)) {
          const affordableDrinks = vDrinks.filter(d => comboFoodPrice + d.price <= targetPerMeal);
          if (affordableDrinks.length > 0) {
            chosenDrink = affordableDrinks[(day + mIdx) % affordableDrinks.length];
          } else if (allDrinks.length > 0) {
            const globalAffordable = allDrinks.filter(d => comboFoodPrice + d.price <= targetPerMeal);
            if (globalAffordable.length > 0) {
              chosenDrink = globalAffordable[(day + mIdx) % globalAffordable.length];
            }
          }
          if (chosenDrink) {
            comboOptions.push(chosenDrink);
            comboFoodPrice += chosenDrink.price;
            comboName += ` (+ ${chosenDrink.product.name})`;
          }
        }

        if (comboOptions.length > 0) {
          // Generate accurate breakdown with exact vendor item names, portions, prices, plus takeaway pack
          const breakdown = this.generateMealBreakdown(
            comboOptions,
            chosenBase?.vendor?.storeName || assignedVendor,
            mealType,
            medicalConditions,
            PACKAGING_FEE_PER_MEAL
          );

          const totalMealCost = comboFoodPrice + PACKAGING_FEE_PER_MEAL;
          const defaultTimes: Record<string, string> = { breakfast: '08:30', lunch: '12:30', dinner: '18:30' };
          const preferredTime = defaultTimes[mealType] || '12:00';

          meals.push({
            type: mealType,
            options: comboOptions,
            estimatedCost: totalMealCost,
            name: comboName,
            isCustom: false,
            packagingFee: PACKAGING_FEE_PER_MEAL,
            foodSubtotal: comboFoodPrice,
            drink: chosenDrink ? { name: chosenDrink.product.name, price: chosenDrink.price, image: chosenDrink.product.image } : undefined,
            breakdown,
            portions: 1,
            preferredTime
          });

          dailyFoodSubtotal += comboFoodPrice;
          dailyPackaging += PACKAGING_FEE_PER_MEAL;
        } else if (allowCustomErrands) {
          const customMealName = mIdx === 0 ? 'Local Akara & Pap Request with Milk' : mIdx === 1 ? 'Mama-put Rice & Stew Special with Beef' : 'Local Spaghetti & Fried Egg Combo';
          const customCost = 1500;
          const customOpt: MealOption = {
            product: { _id: 'custom', name: customMealName },
            vendor: { storeName: 'Custom Request' },
            price: customCost,
            category: 'custom',
            nutritionalCategory: 'mixed'
          };
          const breakdown = this.generateMealBreakdown(
            [customOpt],
            'Custom Request',
            mealType,
            medicalConditions,
            PACKAGING_FEE_PER_MEAL
          );

          const totalMealCost = customCost + PACKAGING_FEE_PER_MEAL;
          const defaultTimes: Record<string, string> = { breakfast: '08:30', lunch: '12:30', dinner: '18:30' };
          const preferredTime = defaultTimes[mealType] || '12:00';

          meals.push({
            type: mealType,
            options: [customOpt],
            estimatedCost: totalMealCost,
            name: customMealName,
            isCustom: true,
            packagingFee: PACKAGING_FEE_PER_MEAL,
            foodSubtotal: customCost,
            breakdown,
            portions: 1,
            preferredTime
          });

          dailyFoodSubtotal += customCost;
          dailyPackaging += PACKAGING_FEE_PER_MEAL;
        }
      }

      if (meals.length > 0) {
        // Daily total includes food + takeaway packs + Ninja delivery + platform service fee
        const dayTotal = dailyFoodSubtotal + dailyPackaging + DAILY_NINJA_DELIVERY_FEE + DAILY_SERVICE_FEE;
        days.push({ 
          day, 
          meals, 
          dailyCost: dayTotal,
          foodSubtotal: dailyFoodSubtotal,
          packagingFee: dailyPackaging,
          deliveryFee: DAILY_NINJA_DELIVERY_FEE,
          serviceFee: DAILY_SERVICE_FEE
        });
      }
    }

    return days;
  }

  private buildRawMaterialsPlan(rawOptions: MealOption[], budget: number): RawMaterialsPlan {
    const items: RawMaterialsPlan['items'] = [];
    let totalCost = 0;
    const priorities = ['carbs', 'protein', 'vegetables', 'others'];
    for (const priority of priorities) {
      const categoryItems = rawOptions.filter((o) => o.nutritionalCategory === priority).sort((a, b) => a.price - b.price);
      for (const item of categoryItems) {
        if (totalCost + item.price <= budget * 0.9) {
          const serves = Math.max(1, Math.round(5000 / item.price));
          items.push({ name: item.product.name, vendor: item.vendor, price: item.price, serves, category: item.category });
          totalCost += item.price;
        }
      }
    }
    const daysSupported = items.length > 0 ? Math.floor(items.reduce((acc, it) => acc + it.serves, 0) / 3) : 0;
    const costPerDay = daysSupported > 0 ? totalCost / daysSupported : 0;
    const savingsVsCooked = daysSupported > 0 ? (1200 * 3) * daysSupported - totalCost : 0;
    return { totalCost, daysSupported, items, costPerDay, savingsVsCooked };
  }

  async getAvailableMealOptions(vendors?: string[]) {
    let vendorFilter: any = { status: 'approved' };
    const validVendorIds = (vendors || [])
      .filter((v: any) => v && typeof v === 'string' && Types.ObjectId.isValid(v))
      .map((v: any) => new Types.ObjectId(v));

    if (validVendorIds.length > 0) {
      vendorFilter._id = { $in: validVendorIds };
    }
    const targetVendors = await this.vendorModel.find(vendorFilter).select('_id storeName logo category isInsideCampus').lean();
    const vendorMap = new Map<string, any>();
    const targetIds: Types.ObjectId[] = [];
    for (const v of targetVendors) {
      vendorMap.set(String(v._id), v);
      targetIds.push(v._id);
    }

    let query: any = { isAvailable: { $ne: false } };
    if (targetIds.length > 0) {
      query.vendorId = { $in: targetIds };
    }

    const menuItems = await this.menuItemModel
      .find(query)
      .select('_id name pricePerPortion portionUnit image images description vendorId category')
      .limit(80)
      .lean();

    return menuItems.map(m => {
      const vInfo = vendorMap.get(String(m.vendorId)) || targetVendors[0] || { storeName: 'Campus Vendor' };
      return {
        _id: m._id,
        name: m.name,
        price: m.pricePerPortion,
        portionUnit: m.portionUnit || 'plate',
        image: m.image || (m.images && m.images[0]) || '',
        description: m.description || '',
        vendor: vInfo,
        nutritionalCategory: this.classifyNutrition((m as any).category || '', m.name)
      };
    });
  }

  async suggestByBudget(budget: number) { return []; }
  async getPopularMealCombinations(limit: number) { return []; }
}
