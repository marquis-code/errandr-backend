import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const UserSchemaDefinition = new mongoose.Schema({}, { strict: false });
const UserModel = mongoose.model('User', UserSchemaDefinition);

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log('✅ Connected to MongoDB');

  const email = 'abahmarquis@gmail.com';
  
  const user = await UserModel.findOneAndUpdate(
    { email },
    { $set: { points: 10000 } },
    { new: true }
  );

  if (user) {
    console.log(`✅ Updated points for ${email} to 10,000.`);
  } else {
    console.log(`❌ User with email ${email} not found.`);
  }

  await mongoose.disconnect();
  console.log('🏁 Done!');
}

main().catch(console.error);
