import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RewardsService } from './rewards.service';
import { RewardsController } from './rewards.controller';
import { Reward, RewardSchema } from './schemas/reward.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Quest, QuestSchema } from './schemas/quest.schema';
import { UserQuest, UserQuestSchema } from './schemas/user-quest.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Reward.name, schema: RewardSchema },
      { name: User.name, schema: UserSchema },
      { name: Quest.name, schema: QuestSchema },
      { name: UserQuest.name, schema: UserQuestSchema },
    ]),
  ],
  controllers: [RewardsController],
  providers: [RewardsService],
  exports: [RewardsService],
})
export class RewardsModule {}
