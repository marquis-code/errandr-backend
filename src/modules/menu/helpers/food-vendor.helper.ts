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
] as const;

export type FoodVendorCategory = (typeof FOOD_VENDOR_CATEGORIES)[number];

export function isFoodVendor(category: string): boolean {
  return FOOD_VENDOR_CATEGORIES.includes(category as FoodVendorCategory);
}
