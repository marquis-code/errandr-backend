import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { OrdersService } from '../src/modules/orders/orders.service';

const payload = {
    "vendorId": "6a4e4ba65be2071e52785438",
    "packs": [
        {
            "packId": "pack_1787527561984_6",
            "name": "Standard Pack",
            "packType": {
                "name": "Standard Pack",
                "price": 150
            },
            "items": [
                {
                    "product": "6a84186e3b38568ca4824028",
                    "name": "Ewa Agoyin",
                    "price": 100,
                    "image": "https://res.cloudinary.com/dfpabtrke/image/upload/v1787041893/erranders/f7oyldj1rt16eu2cyfwi.jpg",
                    "quantity": 1,
                    "subtotal": 100,
                    "customizations": []
                }
            ]
        }
    ],
    "subtotal": 100,
    "deliveryFee": 350,
    "serviceFee": 50,
    "platformProcessingFee": 0,
    "packagingFee": 150,
    "selectedPack": {
        "name": "Standard Pack",
        "price": 150,
        "isActive": true,
        "_id": "6a4e4ba65be2071e52785441"
    },
    "isMysteryBox": false,
    "isDormDelivery": false,
    "deliveryOption": "use_an_errander",
    "deliveryMode": "dropoff_service",
    "recipientName": "Test Order",
    "recipientPhone": "08147626503",
    "specificAddress": "Mushin Back Gate Pharmacy",
    "deliveryAddress": "Mushin Back Gate Pharmacy",
    "weight": 1,
    "isPreOrder": false,
    "scheduledDate": "",
    "wantsNotification": false,
    "notifyEmail": "",
    "useFreeDeliveryToken": false,
    "vendorNote": "",
    "promoCode": "ADMIN001",
    "locationType": "campus_environs",
    "proposedDeliveryFee": 350
};

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const ordersService = app.get(OrdersService);

  console.log('Starting order creation...');
  const start = Date.now();
  try {
    const order = await ordersService.create('6a5fcde64a331e5430a9728f', payload);
    console.log('Order created successfully in', Date.now() - start, 'ms');
    console.log(order._id);
  } catch (err) {
    console.error('Failed to create order:', err);
  }

  await app.close();
}

bootstrap();
