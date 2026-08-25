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
      // === MAIN DISHES ===
      { category: 'MAIN DISHES', name: 'Barbecue Fish', description: 'Barbecue fish served with fried potatoes and sauce', price: 7000 },
      { category: 'MAIN DISHES', name: 'Catfish Peppersoup', description: 'Catfish peppersoup served with eko', price: 8000 },
      { category: 'MAIN DISHES', name: 'Grilled Turkey', description: 'Grilled turkey served with fried potatoes and sauce', price: 4000 },
      { category: 'MAIN DISHES', name: 'Grilled Chicken', description: 'Grilled chicken served with fried potatoes and sauce', price: 6000 },
      { category: 'MAIN DISHES', name: 'Goat Meat Asun', description: 'Seasoned grilled goat meat', price: 3000 },

      // === COMBO/BOX PACKS ===
      { category: 'COMBO/BOX PACKS', name: 'Regular Pack', description: '5 Puff Puff, 1 Spring roll, 1 Samosa, 2 Mosa', price: 1200 },
      { category: 'COMBO/BOX PACKS', name: 'Midi Pack', description: '5 Puff Puff, 1 Spring roll, 1 Samosa, 2 Mosa, 1 Peppered Gizzard', price: 1600 },
      { category: 'COMBO/BOX PACKS', name: 'Delight Pack', description: '5 Puff Puff, 1 Spring roll, 1 Samosa, 2 Mosa, 1 Chicken', price: 2400 },
      { category: 'COMBO/BOX PACKS', name: 'Executive Pack', description: '8 Puff Puff, 1 Spring roll, 1 Samosa, 2 Mosa, 1 Chicken, 1 Peppered Gizzard', price: 2800 },
      { category: 'COMBO/BOX PACKS', name: 'Big Daddi Pack', description: '8 Puff Puff, 1 Spring roll, 1 Samosa, 2 Mosa, 1 Peppered Turkey', price: 3600 },
      { category: 'COMBO/BOX PACKS', name: 'My Mini Platter', description: '18 pieces of fried yams or potatoes (mixing optional), 1 Peppered Turkey, served with Chef Nuru\'s Special Sauce', price: 4000 },
      { category: 'COMBO/BOX PACKS', name: 'Combo Box: Delight Box', description: '8 Puff Puff, 2 Spring Roll, 2 Samosa, 3 Mosa, 1 Chicken, 1 Gizzard', price: 4000 },
      { category: 'COMBO/BOX PACKS', name: 'Combo Box: Double Delight', description: '10 Puff Puff, 2 Spring Roll, 2 Samosa, 3 Mosa, 2 Chicken', price: 5000 },
      { category: 'COMBO/BOX PACKS', name: 'Combo Box: Turkey and Sauce', description: '10 pcs Yam or Potato (mixing optional), 1 Peppered Turkey, Chef Nuru\'s Special Sauce', price: 5000 },
      { category: 'COMBO/BOX PACKS', name: 'Combo Box: Daddi\'s Treat', description: '10 Puff Puff, 3 Spring Roll, 3 Samosa, 4 Mosa, 1 Chicken, 1 Gizzard, 1 Turkey', price: 8000 },
      { category: 'COMBO/BOX PACKS', name: 'Combo Box: Crispy Box', description: '10 pcs Yam or Potato (mixing optional), 2 Beef, 1 Chicken, 1 Gizzard', price: 4000 },
      { category: 'COMBO/BOX PACKS', name: 'Combo Box: Big Bite', description: '16 pcs Yam or Potato (mixing optional), 2 Chicken, 4 Beef, 2 Gizzard', price: 7000 },

      // === SIDES & EXTRAS ===
      { category: 'SIDES & EXTRAS', name: 'Peppered Chicken', description: 'Spiced peppered chicken', price: 2500 },
      { category: 'SIDES & EXTRAS', name: 'Peppered Turkey', description: 'Spiced peppered turkey', price: 100 },
      { category: 'SIDES & EXTRAS', name: 'Peppered Gizzard', description: 'Spiced peppered gizzard', price: 1200 },
      { category: 'SIDES & EXTRAS', name: 'Ponmo', description: 'Cooked beef skin', price: 200 },
      { category: 'SIDES & EXTRAS', name: 'Fried Yam (1 piece)', description: 'Single piece of fried yam', price: 100 },
      { category: 'SIDES & EXTRAS', name: 'Fried Potato (1 piece)', description: 'Single piece of fried potato', price: 100 },
      { category: 'SIDES & EXTRAS', name: 'Plastic Takeaway Pack', description: '', price: 200 },

      // === SMOOTHIES ===
      { category: 'SMOOTHIES', name: 'Fruity Blast - Small', description: 'Watermelon, Banana, Banana & Apple smoothie', price: 1700 },
      { category: 'SMOOTHIES', name: 'Fruity Blast - Large', description: 'Watermelon, Banana & Apple smoothie', price: 2100 },
      { category: 'SMOOTHIES', name: 'Green Machine - Small', description: 'Cucumber, Apple & Banana smoothie', price: 1700 },
      { category: 'SMOOTHIES', name: 'Green Machine - Large', description: 'Cucumber, Apple & Banana smoothie', price: 2100 },
      { category: 'SMOOTHIES', name: 'Paradise Delight - Small', description: 'Pineapple, Banana, Apple & Yoghurt smoothie', price: 1900 },
      { category: 'SMOOTHIES', name: 'Paradise Delight - Large', description: 'Pineapple, Banana, Apple & Yoghurt smoothie', price: 2300 },
      { category: 'SMOOTHIES', name: 'Avocado Dream - Small', description: 'Avocado, Banana, Pineapple, Apple & Yoghurt smoothie', price: 1900 },
      { category: 'SMOOTHIES', name: 'Avocado Dream - Large', description: 'Avocado, Banana, Pineapple, Apple & Yoghurt smoothie', price: 2300 },
      { category: 'SMOOTHIES', name: 'Fruitality Special Combo', description: 'Watermelon, Banana, Cucumber, Pineapple, Apple & Yoghurt', price: 2800 },
      { category: 'SMOOTHIES', name: 'Sugar Rush Special Combo', description: 'Apple, Banana, Pineapple, Grapes & Yoghurt', price: 2800 },
      { category: 'SMOOTHIES', name: 'Heart Beet Special Combo', description: 'Beetroot, Watermelon, Banana, Pineapple, Apple, Dates & Yoghurt', price: 2800 },

      // === MILKSHAKES ===
      { category: 'MILKSHAKES', name: 'Chocolate Milkshake', description: 'Chocolate bar, Vanilla ice cream, milk and ice', price: 3200 },
      { category: 'MILKSHAKES', name: 'Dark Cream Milkshake', description: 'McVities, Vanilla ice cream, milk and ice', price: 3200 },
      { category: 'MILKSHAKES', name: 'Dates Milkshake', description: 'Dates, Vanilla ice cream, banana, milk and ice', price: 3200 },
      { category: 'MILKSHAKES', name: 'Banana Milkshake', description: 'Banana, Apple, Vanilla ice cream, milk and ice', price: 3200 },
      { category: 'MILKSHAKES', name: 'Pineapple Milkshake', description: 'Pineapple, Banana, Vanilla ice cream, milk and ice', price: 3200 },
      { category: 'MILKSHAKES', name: 'Avocado Milkshake', description: 'Avocado, Vanilla ice cream, milk and ice', price: 3200 },

      // === SANDWICHES ===
      { category: 'SANDWICHES', name: 'Egg Sandwich', description: '4 slices of bread, veggies, cream and egg', price: 2600 },
      { category: 'SANDWICHES', name: 'Tuna Sandwich', description: '4 slices of bread, veggies, cream and tuna', price: 3300 },
      { category: 'SANDWICHES', name: 'Chicken Sandwich', description: '4 slices of bread, veggies, cream and chicken', price: 3700 },

      // === PARFAITS ===
      { category: 'PARFAITS', name: 'Medium Cup Parfait', description: 'Greek yoghurt, Granola, Apples, Coconut flakes, Cashew nuts', price: 3500 },
      { category: 'PARFAITS', name: 'Big Cup Parfait', description: 'Greek yoghurt, Granola, Apples, Coconut flakes, Cashew nuts', price: 4000 }
    ];

    let insertedCount = 0;
    
    for (const item of menuItems) {
      // Check if it already exists to avoid duplicates
      const existing = await ProductModel.findOne({ vendor: vendor._id, name: item.name });
      if (!existing) {
        await ProductModel.create({
          vendor: vendor._id,
          name: item.name,
          description: item.description,
          price: item.price,
          category: item.category,
          isAvailable: true,
          image: ''
        });
        insertedCount++;
        console.log(`Inserted: ${item.name}`);
      } else {
        console.log(`Skipped (already exists): ${item.name}`);
      }
    }
    
    console.log(`\nSuccessfully inserted ${insertedCount} new menu items for SmoothieDaddi!`);

  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
