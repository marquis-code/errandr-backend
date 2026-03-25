import { Controller, Get, Put, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard, CurrentUser } from '../../common/decorators';
import { User } from '../users/schemas/user.schema';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all notifications for the logged-in user' })
  async getNotifications(@CurrentUser() user: User) {
    const notifications = await this.notificationsService.getNotifications(
      (user._id as unknown) as string,
    );
    return { success: true, data: notifications };
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get unread notification count' })
  async getUnreadCount(@CurrentUser() user: User) {
    const count = await this.notificationsService.getUnreadCount(
      (user._id as unknown) as string,
    );
    return { success: true, data: { count } };
  }

  @Put(':id/read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markAsRead(@CurrentUser() user: User, @Param('id') id: string) {
    await this.notificationsService.markAsRead(
      (user._id as unknown) as string,
      id,
    );
    return { success: true };
  }

  @Put('read-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@CurrentUser() user: User) {
    await this.notificationsService.markAllAsRead(
      (user._id as unknown) as string,
    );
    return { success: true };
  }
}
