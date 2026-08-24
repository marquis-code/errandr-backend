import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const packModel = app.get<Model<any>>(getModelToken('MenuPack'));
    
    // I know the active IDs from test-mine.ts! Let's just hardcode them to ensure it works.
    const activeBeansId = '6a81583011fb20dd60e65d1c';
    const activeEggId = '6a81583111fb20dd60e65d2e';
    const activeBeefId = '6a81583111fb20dd60e65d39';
    const activeBreadId = '6a81583211fb20dd60e65d42';
    const activePlantainId = '6a81583211fb20dd60e65d47';

    const comboId = '6a8b022a9a228e463a9365a2'; 
    const pack = await packModel.findById(comboId);
    
    if (pack) {
      pack.components = [
        { itemId: new Types.ObjectId(activePlantainId), portions: 1 },
        { itemId: new Types.ObjectId(activeEggId), portions: 1 },
        { itemId: new Types.ObjectId(activeBreadId), portions: 1 },
        { itemId: new Types.ObjectId(activeBeansId), portions: 1 },
        { itemId: new Types.ObjectId(activeBeefId), portions: 1 }
      ];
      await pack.save();
      console.log('Fixed combo with explicit active IDs!');
    }
  } catch (e) {
    console.log(e);
  }
  
  await app.close();
}
bootstrap();
