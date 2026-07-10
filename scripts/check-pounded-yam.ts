import mongoose from 'mongoose';
import { MenuItemSchema } from '../src/modules/menu/schemas/menu-item.schema';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '../.env') });

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/erranders';
  await mongoose.connect(uri);
  const MenuItem = mongoose.model('MenuItem', MenuItemSchema);
  
  const vendorId = '6a5095af1427cb6762f0cb31';
  const item = await MenuItem.findOne({ vendor: new mongoose.Types.ObjectId(vendorId), name: /Pounded Yam/i })
    .populate('modifiers')
    .populate('addOns');
    
  if (item) {
    console.log(`Found: ${item.name}`);
    console.log(`Modifiers:`, item.modifiers);
    console.log(`AddOns:`, item.addOns);
  } else {
    console.log('Not found');
  }
  await mongoose.disconnect();
}
main().catch(console.error);
