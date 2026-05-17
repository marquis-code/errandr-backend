import { Controller, Post, Get, Query, Body, Res, Logger, Inject, forwardRef } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import * as twilio from 'twilio';
import { TwilioService } from './twilio.service';
import { OrdersService } from '../orders/orders.service';
import { OrderStatus } from '../orders/schemas/order.schema';

@ApiTags('Twilio')
@Controller('twilio')
export class TwilioController {
  private readonly logger = new Logger(TwilioController.name);

  constructor(
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
    private readonly twilioService: TwilioService,
  ) {}

  @Post('make-call')
  @ApiOperation({ summary: 'Initiate a voice call with custom TTS' })
  async makeCall(@Body() body: { to: string; message: string }) {
    await this.twilioService.makeCall(body.to, { message: body.message });
    return { success: true, message: 'Call initiated via Twilio' };
  }

  @Post('test-dispatch')
  @ApiOperation({ summary: 'Test the full order dispatch flow' })
  async testDispatch(@Body() body: { to: string }) {
    await this.twilioService.sendOrderDispatchCall(body.to, {
      orderNumber: 'ERR-777',
      orderId: '65e7a9e5b8e7a9e5b8e7a9e5', // Fake ID for testing
      items: ['2x Jollof Rice', '1x Grilled Chicken', '3x Cold Zobo'],
      total: 8500
    });
    return { success: true, message: 'Order dispatch test call initiated' };
  }

  /**
   * TwiML for Order Dispatch
   */
  @Post('voice/order-dispatch')
  @ApiOperation({ summary: 'Generate TwiML for order dispatch' })
  async orderDispatch(
    @Query('orderId') orderId: string,
    @Query('orderNumber') orderNumber: string,
    @Query('items') items: string,
    @Query('total') total: string,
    @Res() res: Response,
  ) {
    const response = new twilio.twiml.VoiceResponse();
    response.say({ voice: 'Polly.Amy' }, `Greetings from Erranders. A new order has been placed. Order number ${orderNumber}.`);
    response.pause({ length: 1 });
    response.say({ voice: 'Polly.Amy' }, `Details: ${items}.`);
    response.say({ voice: 'Polly.Amy' }, `Total amount payable is ${total} Naira.`);
    
    const gather = response.gather({
      numDigits: 1,
      action: `/api/v1/twilio/voice/order-handle?orderId=${orderId}`,
      method: 'POST',
      timeout: 10,
    });
    gather.say({ voice: 'Polly.Amy' }, 'To ACCEPT this order and begin preparation, press 1. To DECLINE this request, press 2.');

    response.say('We did not receive any input. Hanging up.');
    response.hangup();

    res.type('text/xml');
    res.send(response.toString());
  }

  /**
   * Handle Order Dispatch Digit Result
   */
  @Post('voice/order-handle')
  async handleOrder(
    @Query('orderId') orderId: string,
    @Body('Digits') digits: string,
    @Res() res: Response,
  ) {
    const response = new twilio.twiml.VoiceResponse();

    if (digits === '1') {
      response.say('Order accepted. Please start preparation. Thank you!');
      await this.ordersService.updateStatus(orderId, OrderStatus.CONFIRMED, 'system', 'Accepted via Twilio Call');
    } else if (digits === '2') {
      response.say('Order rejected. Goodbye.');
      await this.ordersService.updateStatus(orderId, OrderStatus.CANCELLED, 'system', 'Rejected via Twilio Call');
    } else {
      response.say('Invalid input. Goodbye.');
    }

    response.hangup();
    res.type('text/xml');
    res.send(response.toString());
  }

  /**
   * TwiML for Errander Dispatch
   */
  @Post('voice/errander-dispatch')
  async erranderDispatch(
    @Query('orderId') orderId: string,
    @Query('vendorName') vendorName: string,
    @Query('fee') fee: string,
    @Query('userId') userId: string,
    @Res() res: Response,
  ) {
    const response = new twilio.twiml.VoiceResponse();
    response.say(`Hello! This is Erranders. A new delivery is available from ${vendorName}.`);
    response.say(`The delivery fee is ${fee} Naira.`);
    
    const gather = response.gather({
      numDigits: 1,
      action: `/api/v1/twilio/voice/errander-handle?orderId=${orderId}&userId=${userId}`,
      method: 'POST',
      timeout: 10,
    });
    gather.say('Press 1 to ACCEPT this delivery request.');

    response.say('Goodbye.');
    response.hangup();

    res.type('text/xml');
    res.send(response.toString());
  }

  /**
   * Handle Errander Dispatch Digit Result
   */
  @Post('voice/errander-handle')
  async handleErrander(
    @Query('orderId') orderId: string,
    @Query('userId') userId: string,
    @Body('Digits') digits: string,
    @Res() res: Response,
  ) {
    const response = new twilio.twiml.VoiceResponse();

    if (digits === '1') {
      response.say('Delivery accepted! Please proceed to the store. Details are in your app.');
      await this.ordersService.acceptOrder(orderId, userId);
    } else {
      response.say('Delivery declined. Goodbye.');
    }

    response.hangup();
    res.type('text/xml');
    res.send(response.toString());
  }

  /**
   * TwiML for Voice OTP
   */
  @Post('voice/otp')
  async voiceOtp(@Query('otp') otp: string, @Res() res: Response) {
    const response = new twilio.twiml.VoiceResponse();
    const spaced = otp.split('').join(', ');
    response.say(`Hello. Your Erranders verification code is: ${spaced}. I repeat, ${spaced}. Thank you.`);
    response.hangup();

    res.type('text/xml');
    res.send(response.toString());
  }
}
