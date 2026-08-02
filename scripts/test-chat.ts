import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ChatService } from '../src/modules/chat/chat.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const chatService = app.get(ChatService);
  
  // Find a user ID and vendor owner ID
  // For now, let's just query direct messages from chatModel
  const msgs = await (chatService as any).chatModel.find({ roomType: 'direct' }).limit(5);
  console.log('DIRECT MESSAGES DB:', JSON.stringify(msgs, null, 2));
  
  await app.close();
}
bootstrap();
