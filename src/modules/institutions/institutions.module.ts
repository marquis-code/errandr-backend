import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InstitutionsService } from './institutions.service';
import { InstitutionsController } from './institutions.controller';
import { InstitutionResolver } from './institution-resolver.service';
import { Institution, InstitutionSchema } from './schemas/institution.schema';
import { Vendor, VendorSchema } from '../vendors/schemas/vendor.schema';
import { Service, ServiceSchema } from '../services/schemas/service.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Institution.name, schema: InstitutionSchema },
      { name: Vendor.name, schema: VendorSchema },
      { name: Service.name, schema: ServiceSchema },
    ]),
  ],
  controllers: [InstitutionsController],
  providers: [InstitutionsService, InstitutionResolver],
  // Exported so every other module can scope its queries with InstitutionResolver.
  exports: [InstitutionsService, InstitutionResolver, MongooseModule],
})
export class InstitutionsModule {}
