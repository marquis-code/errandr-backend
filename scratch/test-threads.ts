import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { ChatService } from './src/modules/chat/chat.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const chatService = app.get(ChatService);
  const threads = await chatService.getSupportThreads();
  console.log(JSON.stringify(threads, null, 2));
  await app.close();
}
bootstrap();
