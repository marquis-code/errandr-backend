import * as dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Quest, QuestType } from '../src/modules/rewards/schemas/quest.schema';
import { Model } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const questModel = app.get<Model<Quest>>(getModelToken(Quest.name));

  const initialQuests = [
    {
      title: 'Night Owl',
      description: 'Place 3 orders between 10 PM and 4 AM.',
      type: QuestType.NIGHT_OWL,
      targetValue: 3,
      rewardPoints: 500,
      icon: '🌙',
    },
    {
      title: 'The Explorer',
      description: 'Order from 5 different vendors.',
      type: QuestType.ORDER_COUNT,
      targetValue: 5,
      rewardPoints: 300,
      icon: '🧭',
    },
    {
      title: 'Loyal Student',
      description: 'Maintain a 5-day ordering streak.',
      type: QuestType.STREAK,
      targetValue: 5,
      rewardPoints: 1000,
      icon: '🔥',
    },
    {
      title: 'Swift Hero',
      description: 'Complete 10 deliveries as an Errander.',
      type: QuestType.DELIVERY_COUNT,
      targetValue: 10,
      rewardPoints: 1500,
      icon: '⚡',
    },
  ];

  for (const q of initialQuests) {
    await questModel.findOneAndUpdate({ title: q.title }, q, { upsert: true });
  }

  console.log('Quests seeded successfully!');
  await app.close();
}

bootstrap();
