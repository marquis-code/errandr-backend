import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  try {
    const VendorModel = app.get<Model<any>>(getModelToken('Vendor'));
    const ProductModel = app.get<Model<any>>(getModelToken('Product'));
    
    // Find SmoothieDaddi vendor
    const vendor = await VendorModel.findOne({ storeName: 'SmoothieDaddi' });
    
    if (!vendor) {
      console.error('Vendor SmoothieDaddi not found!');
      process.exit(1);
    }
    
    console.log(`Found vendor: ${vendor.storeName} (${vendor._id})`);
    
    const menuItems = [
      'Barbecue Fish', 'Catfish Peppersoup', 'Grilled Turkey', 'Grilled Chicken', 'Goat Meat Asun',
      'Regular Pack', 'Midi Pack', 'Delight Pack', 'Executive Pack', 'Big Daddi Pack', 'My Mini Platter',
      'Combo Box: Delight Box', 'Combo Box: Double Delight', 'Combo Box: Turkey and Sauce',
      'Combo Box: Daddi\'s Treat', 'Combo Box: Crispy Box', 'Combo Box: Big Bite',
      'Peppered Chicken', 'Peppered Turkey', 'Peppered Gizzard', 'Ponmo', 'Fried Yam (1 piece)',
      'Fried Potato (1 piece)', 'Plastic Takeaway Pack',
      'Fruity Blast - Small', 'Fruity Blast - Large', 'Green Machine - Small', 'Green Machine - Large',
      'Paradise Delight - Small', 'Paradise Delight - Large', 'Avocado Dream - Small', 'Avocado Dream - Large',
      'Fruitality Special Combo', 'Sugar Rush Special Combo', 'Heart Beet Special Combo',
      'Chocolate Milkshake', 'Dark Cream Milkshake', 'Dates Milkshake', 'Banana Milkshake',
      'Pineapple Milkshake', 'Avocado Milkshake',
      'Egg Sandwich', 'Tuna Sandwich', 'Chicken Sandwich',
      'Medium Cup Parfait', 'Big Cup Parfait'
    ];

    const result = await ProductModel.deleteMany({
      vendor: vendor._id,
      name: { $in: menuItems }
    });
    
    console.log(`Successfully deleted ${result.deletedCount} menu items for SmoothieDaddi.`);

  } catch (error) {
    console.error('Error undoing data:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
