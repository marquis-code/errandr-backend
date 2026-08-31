import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { VendorsModule } from './modules/vendors/vendors.module';
import { ProductsModule } from './modules/products/products.module';
import { MenuModule } from './modules/menu/menu.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ErrandersModule } from './modules/erranders/erranders.module';
import { ChatModule } from './modules/chat/chat.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { UploadModule } from './modules/upload/upload.module';
import { AdminModule } from './modules/admin/admin.module';
import { PromoCodesModule } from './modules/promo-codes/promo-codes.module';
import { RedisModule } from './modules/redis/redis.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { ReportsModule } from './modules/reports/reports.module';
import { MealPlannerModule } from './modules/meal-planner/meal-planner.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { WaitlistModule } from './modules/waitlist/waitlist.module';
import { EmailModule } from './modules/email/email.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { GroupOrdersModule } from './modules/group-orders/group-orders.module';
import { RewardsModule } from './modules/rewards/rewards.module';
import { MarketingModule } from './modules/marketing/marketing.module';

import { ReferralsModule } from './modules/referrals/referrals.module';
import { ServicesModule } from './modules/services/services.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { FirebaseModule } from './modules/firebase/firebase.module';
import { SearchModule } from './modules/search/search.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { MapboxModule } from './modules/mapbox/mapbox.module';
import { GlobalProductsModule } from './modules/global-products/global-products.module';
import { PushCampaignsModule } from './modules/push-campaigns/push-campaigns.module';
import { ExamModeModule } from './modules/exam-mode/exam-mode.module';
import { MarketPoolModule } from './modules/market-pool/market-pool.module';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({ isGlobal: true }),

    // Rate limiting
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

    // MongoDB
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
        retryReads: true,
        retryWrites: true,
        serverSelectionTimeoutMS: 30000, // Wait up to 30s for server selection if network is slow
      }),
      inject: [ConfigService],
    }),

    // BullMQ
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          username: configService.get('REDIS_USER'),
          password: configService.get('REDIS_PASSWORD'),
          maxRetriesPerRequest: 3,
          connectTimeout: 5000,
        },
      }),
      inject: [ConfigService],
    }),

    // Scheduling (cron jobs for vendor status checks)
    ScheduleModule.forRoot(),

    // Feature modules
    MapboxModule,
    RedisModule,
    AuthModule,
    UsersModule,
    VendorsModule,
    ProductsModule,
    MenuModule,
    OrdersModule,
    ErrandersModule,
    ChatModule,
    TrackingModule,
    UploadModule,
    AdminModule,
    NotificationsModule,
    FavoritesModule,
    ReportsModule,
    MealPlannerModule,
    WalletsModule,
    WaitlistModule,
    EmailModule,
    PaymentsModule,
    GroupOrdersModule,
    RewardsModule,
    MarketingModule,
    ReferralsModule,
    ServicesModule,
    AppointmentsModule,
    FirebaseModule,
    SearchModule,
    ReviewsModule,
    GlobalProductsModule,
    PushCampaignsModule,
    PromoCodesModule,
    ExamModeModule,
    MarketPoolModule,
  ],
})
export class AppModule {}
