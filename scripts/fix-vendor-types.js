#!/usr/bin/env node
/**
 * One-off repair for vendors stored with the wrong business type.
 *
 * The signup form defaulted businessType to 'physical_product', so any service business
 * whose category is a service category — fumigation, barbing, nails, tutoring — was saved
 * as a food/product vendor. This rewrites them from their category.
 *
 *   MONGODB_URI="..." node scripts/fix-vendor-types.js --dry-run
 *   MONGODB_URI="..." node scripts/fix-vendor-types.js
 */
const mongoose = require('mongoose');

const SERVICE_CATEGORIES = [
  'hair_salon', 'nails', 'eyebrows_lashes', 'beauty_salon', 'medspa', 'spa_sauna',
  'waxing_salon', 'tattooing_piercing', 'tanning_studio', 'fitness_recovery',
  'physical_therapy', 'health_practice', 'pet_grooming', 'other',
];

// Words in a store name or description that mean the vendor comes to you.
const MOBILE_HINTS = ['fumigat', 'mobile', 'on-site', 'onsite', 'come to you', 'home service'];

const dryRun = process.argv.includes('--dry-run');

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const vendors = mongoose.connection.collection('vendors');

  const suspects = await vendors
    .find({
      $or: [{ businessType: { $ne: 'service_provider' } }, { vendorType: { $in: ['service_provider', null] } }],
      $and: [{ $or: [{ category: { $in: SERVICE_CATEGORIES } }, { tags: { $in: SERVICE_CATEGORIES } }] }],
    })
    .toArray();

  console.log(`  found ${suspects.length} vendor(s) whose category is a service but type is not`);

  for (const vendor of suspects) {
    const haystack = `${vendor.storeName || ''} ${vendor.description || ''}`.toLowerCase();
    const mobile = MOBILE_HINTS.some((hint) => haystack.includes(hint));

    const patch = {
      businessType: 'service_provider',
      vendorType: 'single-category',
      ...(mobile ? { serviceLocation: 'mobile_operator' } : {}),
    };

    console.log(
      `  ${dryRun ? 'would fix' : 'fixing'} ${vendor.storeName} (${vendor.category}) ->`,
      JSON.stringify(patch),
    );

    if (!dryRun) {
      await vendors.updateOne({ _id: vendor._id }, { $set: patch });
    }
  }

  await mongoose.disconnect();
  console.log(dryRun ? '  dry run: nothing written' : '  done');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
