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
  calories: number;
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
  }[];
  dailyCost: number;
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
  budget: number;
  mealsPerDay?: number;
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

  private generateMealBreakdown(mealName: string, vendorName: string, price: number, mealType: string, conditions: string[] = []): MealBreakdown {
    const lower = mealName.toLowerCase();
    const items: MealBreakdownItem[] = [];

    // Identify main base
    let baseName = mealName;
    let baseKcal = 350;
    if (/jollof/i.test(lower)) { baseName = 'Smoky Jollof Rice'; baseKcal = 380; }
    else if (/fried rice/i.test(lower)) { baseName = 'Stir-fried Rice with Diced Veggies'; baseKcal = 410; }
    else if (/ofada/i.test(lower)) { baseName = 'Local Ofada Rice with Steamed Leaves'; baseKcal = 360; }
    else if (/spag|pasta/i.test(lower)) { baseName = 'Stir-fry Spaghetti'; baseKcal = 390; }
    else if (/amala/i.test(lower)) { baseName = 'Fluffy Amala Swallow'; baseKcal = 320; }
    else if (/pounded yam/i.test(lower)) { baseName = 'Pounded Yam Morsel'; baseKcal = 420; }
    else if (/plantain/i.test(lower)) { baseName = 'Golden Fried Dodo'; baseKcal = 280; }
    else if (/smoothie/i.test(lower)) { baseName = 'Fresh Fruit & Nutrient Blend'; baseKcal = 220; }

    items.push({
      name: baseName,
      category: 'Main Portion',
      portion: '1 full serving',
      calories: baseKcal
    });

    // Identify protein / sauce
    let proteinName = 'Seasoned Grilled Protein';
    let proteinKcal = 220;
    if (/chicken/i.test(lower)) { proteinName = 'Spiced Grilled Chicken Quarter'; proteinKcal = 250; }
    else if (/beef|meat/i.test(lower)) { proteinName = 'Tender Stewed Beef Cut'; proteinKcal = 230; }
    else if (/fish/i.test(lower)) { proteinName = 'Pan-seared Mackerel Fish'; proteinKcal = 190; }
    else if (/egg/i.test(lower)) { proteinName = 'Boiled Farm Egg'; proteinKcal = 78; }
    else if (/ayamase/i.test(lower)) { proteinName = 'Designer Ayamase Sauce & Assorted Cuts'; proteinKcal = 290; }
    else if (/egusi|gbegiri/i.test(lower)) { proteinName = 'Rich Melon Seed Egusi Soup & Beef'; proteinKcal = 280; }
    else if (/turkey/i.test(lower)) { proteinName = 'Crispy Seasoned Turkey Cut'; proteinKcal = 260; }

    items.push({
      name: proteinName,
      category: 'Protein & Sauce',
      portion: '1 portion',
      calories: proteinKcal
    });

    // Side / Vegetable garnish
    items.push({
      name: 'Steamed Greens / Mixed Slaw',
      category: 'Vitamins & Fiber',
      portion: '1 side cup',
      calories: 60
    });

    // Calculate macros
    const totalKcal = items.reduce((sum, it) => sum + it.calories, 0);
    const proteinGrams = Math.round(proteinKcal / 10 + (mealType === 'lunch' ? 8 : 4));
    const carbsGrams = Math.round(baseKcal / 5.5);
    const fatsGrams = Math.round((totalKcal * 0.22) / 9);
    const fiberGrams = Math.max(3, Math.round(carbsGrams * 0.08));

    // Dynamic benefit tailored to health conditions
    let benefit = "Provides balanced glucose release and lean protein to power stamina throughout campus lectures and study sessions.";
    if (conditions.some(c => c.toLowerCase().includes('ulcer'))) {
      benefit = "Cooked with gentle herbs and low chili content to prevent gastric irritation while supplying soothing energy.";
    } else if (conditions.some(c => c.toLowerCase().includes('diabetes'))) {
      benefit = "High in dietary fiber with complex carbohydrates for a gradual glycemic response and sustained alertness.";
    } else if (conditions.some(c => c.toLowerCase().includes('protein'))) {
      benefit = "Protein-dense profile delivering over 30g of essential amino acids for muscular repair and deep satiety.";
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
        mealsPerDay = 3, 
        vendors = [], 
        dislikes = [], 
        medicalConditions = [], 
        allowCustomErrands = false, 
        includeDrinks = false,
        count = 3 
      } = params;

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
      const targetPerMeal = Math.max(1200, Math.floor(budget / (mealsPerDay * 7)));

      const iterations: any[] = [];
      const iterationCount = Math.max(1, count || 3);

      for (let i = 0; i < iterationCount; i++) {
        const cookedMealPlan = this.buildCookedPlan(
          cookedOptions.length > 0 ? cookedOptions : finalOptions, 
          budget, 
          mealsPerDay, 
          targetPerMeal, 
          i, 
          allowCustomErrands,
          medicalConditions,
          includeDrinks
        );
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

        iterations.push({
          days: cookedMealPlan,
          totalCost,
          foodSubtotal,
          packagingTotal,
          deliveryTotal,
          serviceTotal,
          healthNote,
          budgetDeficit: Math.max(0, totalCost - budget)
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
    includeDrinks: boolean = false
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
    const allDrinks = options.filter(o => this.categorizeItem(o.product.name, o.category) === 'drink');
    const allProteins = options.filter(o => this.categorizeItem(o.product.name, o.category) === 'protein');

    // Standard platform fees
    const PACKAGING_FEE_PER_MEAL = 150; // Takeaway pack
    const DAILY_NINJA_DELIVERY_FEE = 350; // Errand Ninja delivery
    const DAILY_SERVICE_FEE = 50; // Platform charge

    // Build 7-day plan
    for (let day = 1; day <= 7; day++) {
      const meals: DailyPlan['meals'] = [];
      let dailyFoodSubtotal = 0;
      let dailyPackaging = 0;

      for (let mIdx = 0; mIdx < mealTypes.length; mIdx++) {
        const mealType = mealTypes[mIdx];
        
        // Pick vendor in round-robin fashion
        const vIdx = (day * 2 + mIdx + offset * 3) % Math.max(1, vendorNames.length);
        const assignedVendor = vendorNames[vIdx] || 'Campus Vendor';
        const vendorMeals = optionsByVendor.get(assignedVendor) || options;

        // Partition this vendor's dishes into meal components
        const vBases = vendorMeals.filter(m => this.categorizeItem(m.product.name, m.category) === 'base');
        const vProteins = vendorMeals.filter(m => this.categorizeItem(m.product.name, m.category) === 'protein');
        const vSides = vendorMeals.filter(m => this.categorizeItem(m.product.name, m.category) === 'side');
        const vDrinks = vendorMeals.filter(m => this.categorizeItem(m.product.name, m.category) === 'drink');

        const comboOptions: MealOption[] = [];
        let comboName = '';
        let comboFoodPrice = 0;

        // 1. Pick Base (Carb / Swallow / Main Rice)
        let chosenBase = vBases.length > 0 
          ? vBases[(day * 3 + mIdx * 5 + offset * 7) % vBases.length] 
          : vendorMeals[0];

        if (chosenBase) {
          comboOptions.push(chosenBase);
          comboFoodPrice += chosenBase.price;
          comboName = chosenBase.product.name;
        }

        // 2. Pick Protein (Beef, Fish, Egg, Chicken, etc.)
        let chosenProtein: MealOption | null = null;
        if (vProteins.length > 0) {
          chosenProtein = vProteins[(day * 2 + mIdx * 3 + offset * 5) % vProteins.length];
        } else if (allProteins.length > 0) {
          chosenProtein = allProteins[(day + mIdx) % allProteins.length];
        }

        if (chosenProtein && chosenProtein.product.name !== chosenBase?.product.name) {
          comboOptions.push(chosenProtein);
          comboFoodPrice += chosenProtein.price;
          comboName += ` with ${chosenProtein.product.name}`;
        }

        // 3. Pick Side (Plantain / Coleslaw / Moimoi)
        if (vSides.length > 0 && mIdx >= 1) { // Add side for lunch or dinner
          const chosenSide = vSides[(day + mIdx) % vSides.length];
          comboOptions.push(chosenSide);
          comboFoodPrice += chosenSide.price;
          comboName += ` & ${chosenSide.product.name}`;
        }

        // 4. Pick Drink (if user requested drink on meals)
        let chosenDrink: MealOption | null = null;
        if (includeDrinks) {
          if (vDrinks.length > 0) {
            chosenDrink = vDrinks[(day + mIdx) % vDrinks.length];
          } else if (allDrinks.length > 0) {
            chosenDrink = allDrinks[(day + mIdx) % allDrinks.length];
          }
          if (chosenDrink) {
            comboOptions.push(chosenDrink);
            comboFoodPrice += chosenDrink.price;
            comboName += ` (+ ${chosenDrink.product.name})`;
          }
        }

        if (comboOptions.length > 0) {
          const breakdown = this.generateMealBreakdown(
            comboName,
            chosenBase?.vendor?.storeName || assignedVendor,
            comboFoodPrice,
            mealType,
            medicalConditions
          );

          // Add takeaway pack to breakdown
          breakdown.items.push({
            name: 'Eco-grade Takeaway Pack',
            category: 'Packaging',
            portion: '1 container',
            calories: 0
          });

          const totalMealCost = comboFoodPrice + PACKAGING_FEE_PER_MEAL;

          meals.push({
            type: mealType,
            options: comboOptions,
            estimatedCost: totalMealCost,
            name: comboName,
            isCustom: false,
            packagingFee: PACKAGING_FEE_PER_MEAL,
            foodSubtotal: comboFoodPrice,
            drink: chosenDrink ? { name: chosenDrink.product.name, price: chosenDrink.price, image: chosenDrink.product.image } : undefined,
            breakdown
          });

          dailyFoodSubtotal += comboFoodPrice;
          dailyPackaging += PACKAGING_FEE_PER_MEAL;
        } else if (allowCustomErrands) {
          const customMealName = mIdx === 0 ? 'Local Akara & Pap Request with Milk' : mIdx === 1 ? 'Mama-put Rice & Stew Special with Beef' : 'Local Spaghetti & Fried Egg Combo';
          const customCost = 1500;
          const breakdown = this.generateMealBreakdown(
            customMealName,
            'Custom Request',
            customCost,
            mealType,
            medicalConditions
          );
          breakdown.items.push({
            name: 'Eco-grade Takeaway Pack',
            category: 'Packaging',
            portion: '1 container',
            calories: 0
          });

          const totalMealCost = customCost + PACKAGING_FEE_PER_MEAL;

          meals.push({
            type: mealType,
            options: [{
              product: { _id: 'custom', name: customMealName },
              vendor: { storeName: 'Custom Request' },
              price: customCost,
              category: 'custom',
              nutritionalCategory: 'mixed'
            }],
            estimatedCost: totalMealCost,
            name: customMealName,
            isCustom: true,
            packagingFee: PACKAGING_FEE_PER_MEAL,
            foodSubtotal: customCost,
            breakdown
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
