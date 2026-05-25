import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { JwtAuthGuard, CurrentUser } from '../../common/decorators';
import { User } from '../users/schemas/user.schema';

@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('order/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get chat messages for an order' })
  getOrderMessages(@Param('orderId') orderId: string) {
    return this.chatService.getOrderMessages(orderId);
  }

  @Get('support/threads')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all support chat threads (Admin only)' })
  getSupportThreads() {
    return this.chatService.getSupportThreads();
  }

  @Get('support/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get support messages for a specific user' })
  getSupportMessages(@Param('userId') userId: string) {
    return this.chatService.getSupportMessages(userId);
  }

  @Get('unread/orders')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get unread message count per order' })
  getUnreadCountPerOrder(@CurrentUser() user: User) {
    return this.chatService.getUnreadCountPerOrder((user._id as unknown) as string);
  }

  @Get('unread')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get unread message count' })
  getUnreadCount(@CurrentUser() user: User) {
    return this.chatService.getUnreadCount((user._id as unknown) as string);
  }
}
