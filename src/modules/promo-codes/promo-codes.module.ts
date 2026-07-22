import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PromoCodesService } from './promo-codes.service';
import { PromoCodesController } from './promo-codes.controller';
import { PromoCode, PromoCodeSchema } from './schemas/promo-code.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: PromoCode.name, schema: PromoCodeSchema }])
  ],
  controllers: [PromoCodesController],
  providers: [PromoCodesService],
  exports: [PromoCodesService]
})
export class PromoCodesModule {}
