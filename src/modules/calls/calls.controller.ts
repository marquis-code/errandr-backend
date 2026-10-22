import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CallsService } from './calls.service';

/**
 * Call history for an order.
 *
 * The live call runs over the socket gateway; this only serves the record so the UI can
 * show "missed call from your errand ninja, 2:14 pm" inside the order thread.
 */
@Controller('calls')
@UseGuards(AuthGuard('jwt'))
export class CallsController {
  constructor(private readonly calls: CallsService) {}

  @Get('order/:orderId')
  async forOrder(@Param('orderId') orderId: string, @Req() req: any) {
    const userId = req.user?.userId || req.user?._id || req.user?.sub;
    const calls = await this.calls.historyForOrder(orderId, String(userId));
    return { data: calls };
  }
}
