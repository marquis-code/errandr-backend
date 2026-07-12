import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GlobalProductsService } from './global-products.service';
import { GlobalProductsController } from './global-products.controller';
import { GlobalProduct, GlobalProductSchema } from './schemas/global-product.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GlobalProduct.name, schema: GlobalProductSchema },
    ]),
  ],
  controllers: [GlobalProductsController],
  providers: [GlobalProductsService],
  exports: [GlobalProductsService, MongooseModule],
})
export class GlobalProductsModule {}
