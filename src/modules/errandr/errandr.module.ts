import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ErrandrService } from './errandr.service';
import { ErrandrController } from './errandr.controller';
import { Errander, ErranderSchema } from './schemas/errander.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { RewardsModule } from '../rewards/rewards.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Errander.name, schema: ErranderSchema },
      { name: User.name, schema: UserSchema },
    ]),
    RewardsModule,
  ],
  controllers: [ErrandrController],
  providers: [ErrandrService],
  exports: [ErrandrService],
})
export class ErrandrModule {}
