import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ErrandersService } from './erranders.service';
import { ErrandersController } from './erranders.controller';
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
  controllers: [ErrandersController],
  providers: [ErrandersService],
  exports: [ErrandersService],
})
export class ErrandersModule {}
