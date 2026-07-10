import mongoose from 'mongoose';
import { ModifierSchema } from '../src/modules/menu/schemas/modifier.schema';
import { AddOnSchema } from '../src/modules/menu/schemas/add-on.schema';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '../.env') });

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/erranders';
  await mongoose.connect(uri);
  
  const Modifier = mongoose.model('Modifier', ModifierSchema);
  const AddOn = mongoose.model('AddOn', AddOnSchema);

  const vendorId = '6a5095af1427cb6762f0cb31';

  const mods = await Modifier.find({ vendor: new mongoose.Types.ObjectId(vendorId) });
  console.log(`Modifiers for ${vendorId}:`);
  for (const m of mods) console.log(` - ${m.name}`);

  const adds = await AddOn.find({ vendor: new mongoose.Types.ObjectId(vendorId) });
  console.log(`\nAddOns for ${vendorId}:`);
  for (const a of adds) console.log(` - ${a.name}`);

  await mongoose.disconnect();
}

main().catch(console.error);
