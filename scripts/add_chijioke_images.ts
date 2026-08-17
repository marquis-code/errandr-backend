import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MenuItem } from '../src/modules/menu/schemas/menu-item.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const menuItemModel = app.get<Model<MenuItem>>(getModelToken(MenuItem.name));

  const vendorId = new Types.ObjectId('6a4e4d975be2071e5278568c');

  const updates = [
    {
      match: /Jollof Spaghetti/i,
      image: 'https://images.unsplash.com/photo-1626804475297-41609ae08bfe?w=800&q=80'
    },
    {
      match: /Spaghetti, Chips/i,
      image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&q=80'
    },
    {
      match: /Spaghetti \(Without Turkey\)/i,
      image: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800&q=80'
    },
    {
      match: /Suya Rice/i,
      image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800&q=80'
    },
    {
      match: /Coconut Rice/i,
      image: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800&q=80'
    },
    {
      match: /Basmati Rice/i,
      image: 'https://images.unsplash.com/photo-1536304929831-ee1ca9d44906?w=800&q=80'
    },
    {
      match: /Grilled Turkey/i,
      image: 'https://images.unsplash.com/photo-1574672280600-4accfa5b6f98?w=800&q=80'
    },
    {
      match: /Beef/i,
      image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80'
    },
    {
      match: /Eggs/i,
      image: 'https://images.unsplash.com/photo-1587486913049-53fc88980cfc?w=800&q=80'
    },
    {
      match: /Plantain/i,
      image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&q=80'
    }
  ];

  for (const update of updates) {
    const result = await menuItemModel.updateMany(
      { vendorId, name: update.match },
      { $set: { image: update.image, images: [update.image] } }
    );
    console.log(`Updated ${result.modifiedCount} items for ${update.match}`);
  }

  console.log('Finished adding images!');
  await app.close();
  process.exit(0);
}

bootstrap();
