import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CallSession, CallSessionDocument, CallStatus, CallType } from './schemas/call-session.schema';
import { Order } from '../orders/schemas/order.schema';
import { Vendor } from '../vendors/schemas/vendor.schema';
import { User, UserRole } from '../users/schemas/user.schema';

/**
 * Who is allowed to call whom.
 *
 * Calling is not a general chat channel: a call is only permitted between two people who
 * are already transacting on the same order, plus support, who may reach either side
 * (and be reached). Anything else is refused, so a phone number can never be used to
 * cold-call another user.
 */
export interface CallParties {
  customer?: Types.ObjectId;
  errander?: Types.ObjectId;
  vendorOwner?: Types.ObjectId;
}

@Injectable()
export class CallsService {
  constructor(
    @InjectModel(CallSession.name) private callModel: Model<CallSessionDocument>,
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(Vendor.name) private vendorModel: Model<Vendor>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  /** The three people who can be on an order, resolved to user ids. */
  async partiesForOrder(orderId: string): Promise<CallParties> {
    if (!Types.ObjectId.isValid(orderId)) throw new NotFoundException('Order not found');

    const order: any = await this.orderModel
      .findById(orderId)
      .select('customer errander vendor')
      .lean()
      .exec();
    if (!order) throw new NotFoundException('Order not found');

    let vendorOwner: Types.ObjectId | undefined;
    if (order.vendor) {
      const vendor: any = await this.vendorModel
        .findById(order.vendor)
        .select('owner')
        .lean()
        .exec();
      vendorOwner = vendor?.owner;
    }

    return { customer: order.customer, errander: order.errander, vendorOwner };
  }

  private isOnOrder(userId: string, parties: CallParties): boolean {
    const id = String(userId);
    return [parties.customer, parties.errander, parties.vendorOwner]
      .filter(Boolean)
      .some((party) => String(party) === id);
  }

  /**
   * Refuses a call unless both sides belong to the order, or one side is support.
   */
  async assertMayCall(orderId: string, callerId: string, calleeId: string): Promise<void> {
    if (String(callerId) === String(calleeId)) {
      throw new BadRequestException('You cannot call yourself.');
    }

    const parties = await this.partiesForOrder(orderId);

    const caller = await this.userModel.findById(callerId).select('role').lean().exec() as any;
    const callee = await this.userModel.findById(calleeId).select('role').lean().exec() as any;
    if (!caller || !callee) throw new NotFoundException('That person could not be found.');

    const callerIsSupport = caller.role === UserRole.ADMIN;
    const calleeIsSupport = callee.role === UserRole.ADMIN;

    // Support may reach either side of an order, and either side may reach support.
    // In both directions the *customer-facing* party must be on the order, so support
    // cannot be used to cold-call an unrelated user.
    if (callerIsSupport) {
      if (!this.isOnOrder(calleeId, parties)) {
        throw new ForbiddenException('That person is not on this order.');
      }
      return;
    }
    if (calleeIsSupport) {
      if (!this.isOnOrder(callerId, parties)) {
        throw new ForbiddenException('You can only call support about your own orders.');
      }
      return;
    }

    // Otherwise both people must be on this order.
    if (!this.isOnOrder(callerId, parties) || !this.isOnOrder(calleeId, parties)) {
      throw new ForbiddenException(
        'Calls are only available between the customer, the vendor and the errand ninja on the same order.',
      );
    }
  }

  async start(orderId: string, callerId: string, calleeId: string, type: CallType) {
    await this.assertMayCall(orderId, callerId, calleeId);

    return this.callModel.create({
      order: new Types.ObjectId(orderId),
      caller: new Types.ObjectId(callerId),
      callee: new Types.ObjectId(calleeId),
      type,
      status: CallStatus.RINGING,
    });
  }

  async getForParty(callId: string, userId: string): Promise<CallSessionDocument> {
    if (!Types.ObjectId.isValid(callId)) throw new NotFoundException('Call not found');
    const call = await this.callModel.findById(callId).exec();
    if (!call) throw new NotFoundException('Call not found');

    const id = String(userId);
    if (String(call.caller) !== id && String(call.callee) !== id) {
      // Support can inspect a call on an order without being a participant.
      const user = (await this.userModel.findById(userId).select('role').lean().exec()) as any;
      if (user?.role !== UserRole.ADMIN) {
        throw new ForbiddenException('You are not part of this call.');
      }
    }
    return call;
  }

  async accept(callId: string, userId: string) {
    const call = await this.getForParty(callId, userId);
    if (String(call.callee) !== String(userId)) {
      throw new ForbiddenException('Only the person being called can answer.');
    }
    if (call.status !== CallStatus.RINGING) {
      throw new BadRequestException(`This call is ${call.status}.`);
    }

    call.status = CallStatus.ACTIVE;
    call.answeredAt = new Date();
    await call.save();
    return call;
  }

  async decline(callId: string, userId: string) {
    const call = await this.getForParty(callId, userId);
    if (call.status !== CallStatus.RINGING) throw new BadRequestException(`This call is ${call.status}.`);

    call.status = CallStatus.DECLINED;
    call.endedAt = new Date();
    call.endedBy = new Types.ObjectId(userId);
    await call.save();
    return call;
  }

  async end(callId: string, userId: string) {
    const call = await this.getForParty(callId, userId);
    if (call.status === CallStatus.ENDED || call.status === CallStatus.DECLINED) return call;

    call.status = CallStatus.ENDED;
    call.endedAt = new Date();
    call.endedBy = new Types.ObjectId(userId);

    if (call.answeredAt) {
      call.durationSeconds = Math.max(
        0,
        Math.round((call.endedAt.getTime() - new Date(call.answeredAt).getTime()) / 1000),
      );
    }
    await call.save();
    return call;
  }

  /** Ordered calendar of calls on one order, for the customer, vendor and errand ninja. */
  async historyForOrder(orderId: string, userId: string) {
    const parties = await this.partiesForOrder(orderId);
    const user = (await this.userModel.findById(userId).select('role').lean().exec()) as any;
    if (user?.role !== UserRole.ADMIN && !this.isOnOrder(userId, parties)) {
      throw new ForbiddenException('You are not part of this order.');
    }

    return this.callModel
      .find({ order: new Types.ObjectId(orderId) })
      .select('caller callee type status answeredAt endedAt durationSeconds createdAt')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
      .exec();
  }
}
