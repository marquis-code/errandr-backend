import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { VendorsService } from './src/modules/vendors/vendors.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const vendorsService = app.get(VendorsService);

  const payload: any = {
    "businessType": "food",
    "vendorType": "restaurant",
    "storeName": "Old Country Grills And Meals",
    "description": "Delicious homemade meals.",
    "category": "food",
    "address": "College Of Medicine Road, Lagos 10, Lagos, Nigeria",
    "location": {
        "type": "Point",
        "coordinates": [
            0,
            0
        ]
    },
    "logo": "https://res.cloudinary.com/dfpabtrke/image/upload/v1787420161/erranders/vbyx9kvv7j9two4hamzc.jpg",
    "banner": "https://res.cloudinary.com/dfpabtrke/image/upload/v1787420164/erranders/p7xrs3hwak6ajr4rkz2b.jpg",
    "isInsideCampus": false,
    "requiresPrepTime": false,
    "requiresTakeawayPack": false,
    "operatingHours": {
        "open": "08:00",
        "close": "20:00"
    },
    "preparationTime": 15,
    "minimumOrder": 0,
    "packs": [
        {
            "_id": "6a89dde37c25d2ef0dd1294d",
            "name": "Standard Pack",
            "price": 300,
            "isActive": true
        }
    ],
    "businessHours": [
        {
            "_id": "6a89dde37c25d2ef0dd12946",
            "day": "monday",
            "open": "00:00",
            "close": "23:59",
            "isClosed": false
        },
        {
            "_id": "6a89dde37c25d2ef0dd12947",
            "day": "tuesday",
            "open": "00:00",
            "close": "23:59",
            "isClosed": false
        },
        {
            "_id": "6a89dde37c25d2ef0dd12948",
            "day": "wednesday",
            "open": "00:00",
            "close": "23:59",
            "isClosed": false
        },
        {
            "_id": "6a89dde37c25d2ef0dd12949",
            "day": "thursday",
            "open": "00:00",
            "close": "23:59",
            "isClosed": false
        },
        {
            "_id": "6a89dde37c25d2ef0dd1294a",
            "day": "friday",
            "open": "00:00",
            "close": "23:59",
            "isClosed": false
        },
        {
            "_id": "6a89dde37c25d2ef0dd1294b",
            "day": "saturday",
            "open": "00:00",
            "close": "23:59",
            "isClosed": false
        },
        {
            "_id": "6a89dde37c25d2ef0dd1294c",
            "day": "sunday",
            "open": "00:00",
            "close": "23:59",
            "isClosed": false
        }
    ],
    "breakPeriod": {
        "start": "14:00",
        "end": "15:00",
        "enabled": false
    },
    "accountPurposes": [
        "Default / General"
    ]
  };

  try {
      console.log("Updating via NestJS Context...");
      const id = "6a89dd8efafcc95c3a312edf";
      const ownerId = "6a6104c14fa7c538a7c72026"; // user._id
      const res = await vendorsService.update(id, ownerId, payload);
      console.log("Success!");
  } catch (e) {
      console.log("Validation Error Details:");
      console.dir(e, { depth: null });
  }

  await app.close();
  process.exit(0);
}

bootstrap();
