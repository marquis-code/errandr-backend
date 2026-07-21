/**
 * Food vendor categories — only these vendor types can use the Menu module.
 * Groceries are intentionally excluded (they use the simpler Product model).
 */
export const FOOD_VENDOR_CATEGORIES = [
  'restaurant',
  'eatery',
  'snacks',
  'drinks',
  'bakery',
  'food',
  'mini-mart',
] as const;

export type FoodVendorCategory = (typeof FOOD_VENDOR_CATEGORIES)[number];

export function isFoodVendor(vendor: any): boolean {
  const types = [
    (vendor?.businessType || '').toLowerCase(),
    (vendor?.storeType || '').toLowerCase(),
    (vendor?.vendorType || '').toLowerCase(),
  ];
  const cat = (vendor?.category || '').toLowerCase();
  
  return FOOD_VENDOR_CATEGORIES.includes(cat as any) || 
         types.includes('food') || 
         types.includes('restaurant') ||
         types.includes('mini-mart');
}
