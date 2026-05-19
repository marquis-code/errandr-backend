import { Controller, Post, Get, Query, Body, Res, Logger, Inject, forwardRef } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { AfricasTalkingService } from './africastalking.service';
import { OrdersService } from '../orders/orders.service';
import { OrderStatus } from '../orders/schemas/order.schema';
import { ConfigService } from '@nestjs/config';

@ApiTags('AfricasTalking')
@Controller('africastalking')
export class AfricasTalkingController {
  private readonly logger = new Logger(AfricasTalkingController.name);

  constructor(
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
    private readonly africastalkingService: AfricasTalkingService,
    private readonly configService: ConfigService,
  ) {}

  @Post('make-call')
  @ApiOperation({ summary: 'Initiate a voice call with custom TTS' })
  async makeCall(@Body() body: { to: string; message: string }) {
    await this.africastalkingService.makeCall(body.to, { message: body.message });
    return { success: true, message: "Call initiated via Africa's Talking" };
  }

  @Post('test-dispatch')
  @ApiOperation({ summary: 'Test the full order dispatch flow' })
  async testDispatch(@Body() body: { to: string }) {
    await this.africastalkingService.sendOrderDispatchCall(body.to, {
      orderNumber: 'ERR-777',
      orderId: '65e7a9e5b8e7a9e5b8e7a9e5', // Fake ID for testing
      items: ['2x Jollof Rice', '1x Grilled Chicken', '3x Cold Zobo'],
      total: 8500,
    });
    return { success: true, message: 'Order dispatch test call initiated' };
  }

  /**
   * Single Callback URL for all Africa's Talking outbound voice calls
   */
  @Post('voice/callback')
  @ApiOperation({ summary: "Africa's Talking voice callback webhook" })
  async voiceCallback(
    @Body('isActive') isActive: string,
    @Body('sessionId') sessionId: string,
    @Body('direction') direction: string,
    @Body('callerNumber') callerNumber: string,
    @Body('destinationNumber') destinationNumber: string,
    @Res() res: Response,
  ) {
    res.type('text/xml');

    if (isActive !== '1') {
      // Call is not active (hung up or failed), return empty response
      res.send('<Response/>');
      return;
    }

    const phone = destinationNumber || callerNumber;
    if (!phone) {
      res.send('<Response><Say>Error, phone number missing.</Say></Response>');
      return;
    }

    const activeCall = this.africastalkingService.getActiveCall(phone);
    if (!activeCall) {
      this.logger.warn(`No active call record found for phone: ${phone}`);
      res.send('<Response><Say>Hello from Erranders. Goodbye.</Say></Response>');
      return;
    }

    const baseUrl = this.configService.get<string>('BACKEND_BASE_URL') || '';
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n';

    switch (activeCall.type) {
      case 'order-dispatch':
        xml += `    <Say>Greetings from Erranders. A new order has been placed. Order number ${activeCall.orderNumber}.</Say>\n`;
        xml += `    <Say>Details: ${activeCall.items.join(', ')}.</Say>\n`;
        xml += `    <Say>Total amount payable is ${activeCall.total} Naira.</Say>\n`;
        xml += `    <GetDigits timeout="15" numDigits="1" callbackUrl="${baseUrl}/api/v1/africastalking/voice/order-handle?orderId=${activeCall.orderId}">\n`;
        xml += `        <Say>To ACCEPT this order and begin preparation, press 1. To DECLINE this request, press 2.</Say>\n`;
        xml += `    </GetDigits>\n`;
        xml += `    <Say>We did not receive any input. Hanging up.</Say>\n`;
        break;

      case 'errander-dispatch':
        xml += `    <Say>Hello! This is Erranders. A new delivery is available from ${activeCall.vendorName}.</Say>\n`;
        xml += `    <Say>The delivery fee is ${activeCall.fee} Naira.</Say>\n`;
        xml += `    <GetDigits timeout="15" numDigits="1" callbackUrl="${baseUrl}/api/v1/africastalking/voice/errander-handle?orderId=${activeCall.orderId}&amp;userId=${activeCall.userId}">\n`;
        xml += `        <Say>Press 1 to ACCEPT this delivery request.</Say>\n`;
        xml += `    </GetDigits>\n`;
        xml += `    <Say>Goodbye.</Say>\n`;
        break;

      case 'voice-otp':
        const spaced = activeCall.otp.split('').join(', ');
        xml += `    <Say>Hello. Your Erranders verification code is: ${spaced}. I repeat, ${spaced}. Thank you.</Say>\n`;
        this.africastalkingService.clearActiveCall(phone);
        break;

      case 'announcement':
        xml += `    <Say>${activeCall.message}</Say>\n`;
        this.africastalkingService.clearActiveCall(phone);
        break;

      default:
        xml += `    <Say>Hello from Erranders. Goodbye.</Say>\n`;
    }

    xml += '</Response>';
    res.send(xml);
  }

  /**
   * Handle Order Dispatch Digit Result
   */
  @Post('voice/order-handle')
  async handleOrder(
    @Query('orderId') orderId: string,
    @Body('dtmfDigits') dtmfDigits: string,
    @Body('callerNumber') callerNumber: string,
    @Res() res: Response,
  ) {
    const responseXml = '<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n';
    let sayMessage = '';

    if (dtmfDigits === '1') {
      sayMessage = 'Order accepted. Please start preparation. Thank you!';
      await this.ordersService.updateStatus(orderId, OrderStatus.CONFIRMED, 'system', "Accepted via Africa's Talking Call");
    } else if (dtmfDigits === '2') {
      sayMessage = 'Order rejected. Goodbye.';
      await this.ordersService.updateStatus(orderId, OrderStatus.CANCELLED, 'system', "Rejected via Africa's Talking Call");
    } else {
      sayMessage = 'Invalid input. Goodbye.';
    }

    if (callerNumber) {
      this.africastalkingService.clearActiveCall(callerNumber);
    }

    res.type('text/xml');
    res.send(`${responseXml}    <Say>${sayMessage}</Say>\n</Response>`);
  }

  /**
   * Handle Errander Dispatch Digit Result
   */
  @Post('voice/errander-handle')
  async handleErrander(
    @Query('orderId') orderId: string,
    @Query('userId') userId: string,
    @Body('dtmfDigits') dtmfDigits: string,
    @Body('callerNumber') callerNumber: string,
    @Res() res: Response,
  ) {
    const responseXml = '<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n';
    let sayMessage = '';

    if (dtmfDigits === '1') {
      sayMessage = 'Delivery accepted! Please proceed to the store. Details are in your app.';
      await this.ordersService.acceptOrder(orderId, userId);
    } else {
      sayMessage = 'Delivery declined. Goodbye.';
    }

    if (callerNumber) {
      this.africastalkingService.clearActiveCall(callerNumber);
    }

    res.type('text/xml');
    res.send(`${responseXml}    <Say>${sayMessage}</Say>\n</Response>`);
  }
}
