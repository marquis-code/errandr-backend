/**
 * Idempotent campus bootstrap / migration.
 *
 * Creates the College of Medicine, University of Lagos (`cmul`) campus and
 * assigns it to every existing user, vendor and order whose `institution` is
 * still unset, so nothing is orphaned and current behaviour is preserved.
 *
 * Safe to run any number of times:
 *   - the campus is upserted on its unique `slug` and never re-written,
 *   - documents that already carry an institution are matched by nothing.
 *
 * Usage (from `marketplace/backend`):
 *   npm run seed:institutions
 *   MONGODB_URI="mongodb://127.0.0.1:27017/erranders-e2e" npm run seed:institutions
 *
 * It is deliberately self-contained: it builds its own Nest application
 * context out of the real schemas (no AppModule, so no Redis/Bull/Firebase
 * side effects) and reads `MONGODB_URI` from the environment or `.env`.
 */
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Institution, InstitutionSchema } from './schemas/institution.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Vendor, VendorSchema } from '../vendors/schemas/vendor.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';

const CMUL = {
  name: 'College of Medicine, University of Lagos',
  shortName: 'CMUL',
  slug: 'cmul',
  city: 'Lagos',
  state: 'Lagos',
  country: 'Nigeria',
  // Idi-Araba campus centre. GeoJSON order: [longitude, latitude].
  center: { type: 'Point', coordinates: [3.3469, 6.5147] },
  deliveryRadiusKm: 8,
  isActive: true,
  branding: {
    primaryColor: '#FF5C1A',
    tagline: 'Campus life, elevated.',
  },
  supportedAppTypes: ['student', 'vendor', 'dispatch'],
  contactEmail: 'support@erranders.org',
};

/** Matches documents that have never been assigned to a campus. */
const UNASSIGNED = { $or: [{ institution: { $exists: false } }, { institution: null }] };

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const uri = configService.get<string>('MONGODB_URI');
        if (!uri) {
          throw new Error('MONGODB_URI is not set (env or backend/.env)');
        }
        return { uri };
      },
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: Institution.name, schema: InstitutionSchema },
      { name: User.name, schema: UserSchema },
      { name: Vendor.name, schema: VendorSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
  ],
})
class InstitutionSeedModule {}

export async function seedInstitutions(): Promise<void> {
  const app = await NestFactory.createApplicationContext(InstitutionSeedModule, {
    logger: ['error', 'warn'],
  });

  try {
    const institutionModel = app.get<Model<Institution>>(getModelToken(Institution.name));
    const userModel = app.get<Model<User>>(getModelToken(User.name));
    const vendorModel = app.get<Model<Vendor>>(getModelToken(Vendor.name));
    const orderModel = app.get<Model<Order>>(getModelToken(Order.name));

    // 1. Upsert the campus on its unique slug. $setOnInsert keeps the run
    // idempotent and leaves any later admin edits alone.
    const existing = await institutionModel.findOne({ slug: CMUL.slug }).exec();
    const institution = await institutionModel
      .findOneAndUpdate({ slug: CMUL.slug }, { $setOnInsert: CMUL }, { upsert: true, new: true })
      .exec();

    console.log(
      existing
        ? `Institution "${CMUL.name}" (${CMUL.slug}) already exists — left untouched.`
        : `Created institution "${CMUL.name}" (${CMUL.slug}).`,
    );

    if (!institution) {
      throw new Error(`Failed to upsert institution "${CMUL.slug}"`);
    }
    const institutionId = institution._id as Types.ObjectId;

    // 2. Backfill only the documents that have no institution yet.
    const [users, vendors, orders] = await Promise.all([
      userModel.updateMany(UNASSIGNED, { $set: { institution: institutionId } }).exec(),
      vendorModel.updateMany(UNASSIGNED, { $set: { institution: institutionId } }).exec(),
      orderModel.updateMany(UNASSIGNED, { $set: { institution: institutionId } }).exec(),
    ]);

    console.log('Backfill complete:');
    console.log(`  users:   ${users.modifiedCount} assigned (${users.matchedCount} matched)`);
    console.log(`  vendors: ${vendors.modifiedCount} assigned (${vendors.matchedCount} matched)`);
    console.log(`  orders:  ${orders.modifiedCount} assigned (${orders.matchedCount} matched)`);
    console.log(
      `  total:   ${users.modifiedCount + vendors.modifiedCount + orders.modifiedCount} documents touched`,
    );
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  seedInstitutions()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Institution seed failed:', error);
      process.exit(1);
    });
}
