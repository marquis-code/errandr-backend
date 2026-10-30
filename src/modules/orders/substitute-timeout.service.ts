import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderStatus } from './schemas/order.schema';
import { OrdersService } from './orders.service';

/**
 * Answers a substitution request the customer never answered.
 *
 * When an item runs out the rider offers a replacement and the order stalls until the
 * student replies. A student in a lecture does not reply, the rider stands in the shop, and
 * someone ends up on the phone to support — which is exactly what this system exists to
 * avoid.
 *
 * After the grace period the item is treated as unavailable: the line is refunded to the
 * student's wallet and the rest of the order continues. The customer keeps the money and
 * never loses the order because they were busy.
 */
@Injectable()
export class SubstituteTimeoutService {
  private readonly logger = new Logger(SubstituteTimeoutService.name);

  /** How long a student has to answer before we decide for them. */
  private readonly GRACE_MINUTES = 3;

  constructor(
    @InjectModel(Order.name) private orderModel: Model<Order>,
    private readonly ordersService: OrdersService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async resolveStaleRequests(): Promise<void> {
    const cutoff = new Date(Date.now() - this.GRACE_MINUTES * 60 * 1000);

    // Only orders still in flight: a completed or cancelled order must never be touched.
    const candidates = await this.orderModel
      .find({
        status: { $nin: [OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
        $or: [
          { 'menuItems.status': 'pending_substitute' },
          { 'items.status': 'pending_substitute' },
          { 'packs.items.status': 'pending_substitute' },
        ],
      })
      .select('_id orderNumber updatedAt menuItems items packs customer')
      .lean()
      .exec();

    if (!candidates.length) return;

    for (const order of candidates as any[]) {
      // The request is considered stale from the last time the order changed.
      const lastTouched = order.updatedAt ? new Date(order.updatedAt) : new Date(0);
      if (lastTouched > cutoff) continue;

      const staleItem = this.findPendingItem(order);
      if (!staleItem) continue;

      try {
        // markItemUnavailable refunds the line, adjusts the shares and notifies the
        // student — the same path as a deliberate refund, so the ledger stays consistent.
        await this.ordersService.markItemUnavailable(
          String(order._id),
          staleItem.id,
          String(order.customer),
        );

        this.logger.log(
          `Auto-refunded unanswered substitute on ${order.orderNumber} (item ${staleItem.name})`,
        );
      } catch (error: any) {
        // One bad order must not stop the sweep.
        this.logger.warn(
          `Could not auto-resolve substitute on ${order.orderNumber}: ${error?.message || error}`,
        );
      }
    }
  }

  /** The first item still waiting on an answer, with the id markItemUnavailable expects. */
  private findPendingItem(order: any): { id: string; name: string } | null {
    const fromList = (list: any[]) =>
      (list || []).find((item: any) => item?.status === 'pending_substitute');

    const direct = fromList(order.menuItems) || fromList(order.items);
    if (direct) {
      return {
        id: String(direct._id || direct.menuItem || direct.product),
        name: direct.name || 'the item',
      };
    }

    for (const pack of order.packs || []) {
      const inPack = fromList(pack.items);
      if (inPack) {
        return {
          id: String(inPack._id || inPack.menuItem || inPack.product),
          name: inPack.name || 'the item',
        };
      }
    }

    return null;
  }
}
