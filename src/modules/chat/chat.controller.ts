import { Controller, Get, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { JwtAuthGuard, CurrentUser } from '../../common/decorators';
import { User } from '../users/schemas/user.schema';
import { Body, Post } from '@nestjs/common';

@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('order/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get chat messages for an order (optionally filtered by participant pair)' })
  getOrderMessages(
    @Param('orderId') orderId: string,
    @Query('userA') userA?: string,
    @Query('userB') userB?: string,
  ) {
    return this.chatService.getOrderMessages(orderId, userA, userB);
  }

  @Get('appointment/:appointmentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get chat messages for an appointment' })
  getAppointmentMessages(@Param('appointmentId') appointmentId: string) {
    return this.chatService.getAppointmentMessages(appointmentId);
  }

  @Get('direct/conversations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all generic direct conversations for a user' })
  getDirectConversations(@CurrentUser() user: User) {
    return this.chatService.getDirectConversations((user._id as unknown) as string);
  }

  @Get('direct/:vendorOwnerId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get chat messages between a user and a vendor owner' })
  getDirectMessages(@CurrentUser() user: User, @Param('vendorOwnerId') vendorOwnerId: string) {
    return this.chatService.getDirectMessages((user._id as unknown) as string, vendorOwnerId);
  }

  @Post('rooms/create')
  @ApiOperation({ summary: 'Create or get a chat room for support' })
  createRoom(@Body() payload: { userId: string, businessId?: string, isGuest?: boolean }) {
    return {
      _id: payload.userId,
      roomType: 'support',
      roomName: 'Support',
      businessId: payload.businessId
    };
  }

  @Get('rooms/:roomId/messages')
  @ApiOperation({ summary: 'Get chat messages for a room' })
  getRoomMessages(@Param('roomId') roomId: string) {
    // For support, the roomId is actually the userId
    return this.chatService.getSupportMessages(roomId);
  }

  @Post('rooms/:roomId/messages')
  @ApiOperation({ summary: 'Send a message to a room via REST' })
  sendMessage(@Param('roomId') roomId: string, @Body() payload: any) {
    return this.chatService.createMessage({
      orderId: payload.roomType === 'order' ? roomId : undefined,
      senderId: payload.senderId,
      receiverId: payload.receiverId,
      message: payload.content || payload.message,
      messageType: payload.messageType,
      roomType: payload.roomType || 'support',
      attachment: payload.attachments?.[0]
    });
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
