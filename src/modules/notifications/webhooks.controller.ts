import { Controller, Post, Body, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('zavu')
  @ApiOperation({ summary: 'Zavu Inbound & Delivery Webhook Endpoint' })
  async handleZavuWebhook(
    @Body() body: any,
    @Headers('x-zavu-signature') signature?: string,
  ) {
    return this.notificationsService.handleZavuWebhook(body, signature);
  }
}
