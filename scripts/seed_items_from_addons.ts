import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MenuItem } from '../src/modules/menu/schemas/menu-item.schema';
import { AddOnGroup } from '../src/modules/menu/schemas/add-on.schema';
import { Vendor } from '../src/modules/vendors/schemas/vendor.schema';

async function seed() {
  console.log('Bootstrapping app context...');
  const app = await NestFactory.createApplicationContext(AppModule);

  const ItemModel = app.get<Model<MenuItem>>(getModelToken(MenuItem.name));
  const AddOnGroupModel = app.get<Model<AddOnGroup>>(getModelToken(AddOnGroup.name));
  const VendorModel = app.get<Model<Vendor>>(getModelToken(Vendor.name));

  const vendors = await VendorModel.find({ category: 'restaurant' });
  // Some vendors might have 'Food' instead of 'restaurant' as category
  const allVendors = await VendorModel.find({ category: { $in: ['restaurant', 'Food', 'food'] } });

  for (const vendor of allVendors) {
    console.log(`Processing vendor: ${vendor.storeName}`);
    const addOnGroups = await AddOnGroupModel.find({ vendorId: vendor._id });
    
    for (const group of addOnGroups) {
      for (const option of group.options || []) {
        // Skip some generic options if needed, but we can seed everything
        const existingItem = await ItemModel.findOne({ vendorId: vendor._id, name: option.name });
        if (!existingItem) {
          console.log(`Creating item for ${option.name} for vendor ${vendor.storeName}`);
          await ItemModel.create({
            vendorId: vendor._id,
            name: option.name,
            pricePerPortion: option.price || 0,
            isAvailable: true,
            trackStock: false,
            stockQuantity: 0,
            description: `A la carte ${option.name}`
          });
        }
      }
    }
  }

  console.log('Done!');
  await app.close();
  process.exit(0);
}

seed().catch(console.error);
