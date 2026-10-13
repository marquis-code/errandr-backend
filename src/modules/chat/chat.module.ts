import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatMessage, ChatMessageSchema } from './schemas/chat-message.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Appointment, AppointmentSchema } from '../appointments/schemas/appointment.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatMessage.name, schema: ChatMessageSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Appointment.name, schema: AppointmentSchema },
      { name: User.name, schema: UserSchema },
    ]),
    // Same JWT secret/strategy the REST JwtAuthGuard uses (see AuthModule).
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: configService.get('JWT_EXPIRATION', '7d') },
      }),
      inject: [ConfigService],
    }),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [ChatController],
  providers: [ChatGateway, ChatService],
  exports: [ChatService],
})
export class ChatModule {}
