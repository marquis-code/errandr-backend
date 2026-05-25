import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { GroupOrder, GroupOrderDocument } from './schemas/group-order.schema';
import { GroupOrdersGateway } from './group-orders.gateway';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class GroupOrdersService {
  constructor(
    @InjectModel(GroupOrder.name) private groupOrderModel: Model<GroupOrderDocument>,
    private readonly gateway: GroupOrdersGateway,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
  ) {}

  async create(hostId: string, vendorId: string, name?: string, spendingLimit?: number): Promise<GroupOrder> {
    const inviteCode = uuidv4().slice(0, 8).toUpperCase();
    const groupOrder = await this.groupOrderModel.create({
      host: new Types.ObjectId(hostId),
      vendor: new Types.ObjectId(vendorId),
      inviteCode,
      name: name || `Group Order - ${new Date().toLocaleDateString()}`,
      spendingLimit,
      participants: [
        {
          user: new Types.ObjectId(hostId),
          items: [],
          isReady: false,
          total: 0,
        },
      ],
    });
    return groupOrder;
  }

  async findByCode(inviteCode: string): Promise<any> {
    const rawOrder = await this.groupOrderModel.findOne({ inviteCode }).lean();
    if (!rawOrder) throw new NotFoundException('Group order not found');

    const groupOrder = await this.groupOrderModel.findOne({ inviteCode })
      .populate('vendor', 'storeName logo banner deliveryFee packagingFee')
      .populate('host', 'firstName lastName avatar')
      .populate('participants.user', 'firstName lastName avatar')
      .lean();

    if (!groupOrder) throw new NotFoundException('Group order not found');

    if (!groupOrder.host) {
      groupOrder.host = { _id: rawOrder.host, firstName: 'Guest', lastName: '' } as any;
    }
    
    groupOrder.participants.forEach((p: any, i: number) => {
      if (!p.user) {
        p.user = { _id: rawOrder.participants[i].user, firstName: 'Guest', lastName: '' };
      }
    });

    return groupOrder;
  }

  async getUserHistory(userId: string): Promise<GroupOrderDocument[]> {
    return this.groupOrderModel.find({
      $or: [
        { host: new Types.ObjectId(userId) },
        { 'participants.user': new Types.ObjectId(userId) }
      ]
    })
    .sort({ createdAt: -1 })
    .populate('vendor', 'storeName logo banner')
    .populate('host', 'firstName lastName avatar')
    .populate('participants.user', 'firstName lastName avatar');
  }

  async join(userId: string, inviteCode: string): Promise<GroupOrder> {
    const groupOrder = await this.groupOrderModel.findOne({ inviteCode });
    if (!groupOrder) throw new NotFoundException('Group order not found');
    
    if (groupOrder.status !== 'open') {
      throw new BadRequestException('This group order is no longer accepting participants');
    }

    const userIdStr = userId.toString();
    const isParticipant = groupOrder.participants.some(
      (p) => p.user.toString() === userIdStr
    );

    if (!isParticipant) {
      groupOrder.participants.push({
        user: new Types.ObjectId(userId) as any,
        items: [],
        isReady: false,
        total: 0,
        hasPaid: false,
      });
      await groupOrder.save();
      
      const populated = await this.findByCode(inviteCode);
      const newUser = populated.participants.find(
        p => p.user && p.user['_id']?.toString() === userIdStr
      )?.user || { _id: userIdStr, firstName: 'Guest', lastName: '' };
      this.gateway.broadcastMemberJoined(inviteCode, newUser);
      return populated;
    }

    return this.findByCode(inviteCode);
  }

  async leave(userId: string, inviteCode: string): Promise<GroupOrder> {
    const groupOrder = await this.groupOrderModel.findOne({ inviteCode });
    if (!groupOrder) throw new NotFoundException('Group order not found');

    const userIdStr = userId.toString();
    groupOrder.participants = groupOrder.participants.filter(
      (p) => p.user && p.user.toString() !== userIdStr
    );
    await groupOrder.save();
    
    const populated = await this.findByCode(inviteCode);
    this.gateway.broadcastUpdate(inviteCode, populated);
    return populated;
  }

  async updateItems(userId: string, inviteCode: string, items: any[]): Promise<GroupOrder> {
    const groupOrder = await this.groupOrderModel.findOne({ inviteCode });
    if (!groupOrder) throw new NotFoundException('Group order not found');
    
    if (groupOrder.status !== 'open') {
      throw new BadRequestException('Cannot update items in a locked or completed order');
    }

    const userIdStr = userId.toString();
    const participantIndex = groupOrder.participants.findIndex(
      (p) => p.user && p.user.toString() === userIdStr
    );

    if (participantIndex === -1) {
      throw new BadRequestException('User is not a participant in this group order');
    }

    // Calculate total for this participant
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    groupOrder.participants[participantIndex].items = items;
    groupOrder.participants[participantIndex].total = total;
    groupOrder.participants[participantIndex].isReady = true; // Auto-ready when items are updated from cart
    
    await groupOrder.save();
    
    this.gateway.broadcastItemsUpdated(inviteCode, { userId: userIdStr, items, total });
    
    return this.findByCode(inviteCode);
  }

  async toggleReady(userId: string, inviteCode: string, isReady: boolean): Promise<GroupOrder> {
    const groupOrder = await this.groupOrderModel.findOne({ inviteCode });
    if (!groupOrder) throw new NotFoundException('Group order not found');

    const userIdStr = userId.toString();
    const participantIndex = groupOrder.participants.findIndex(
      (p) => p.user && p.user.toString() === userIdStr
    );

    if (participantIndex === -1) {
      throw new BadRequestException('User is not a participant in this group order');
    }

    groupOrder.participants[participantIndex].isReady = isReady;
    await groupOrder.save();
    
    this.gateway.broadcastUpdate(inviteCode, await this.findByCode(inviteCode));
    
    return this.findByCode(inviteCode);
  }

  async updateStatus(hostId: string, inviteCode: string, status: string): Promise<GroupOrder> {
    const groupOrder = await this.groupOrderModel.findOne({ inviteCode });
    if (!groupOrder) throw new NotFoundException('Group order not found');
    
    if (groupOrder.host.toString() !== hostId.toString()) {
      throw new BadRequestException('Only the host can update the group order status');
    }

    groupOrder.status = status;
    await groupOrder.save();
    
    this.gateway.broadcastStatusChanged(inviteCode, status);
    
    return this.findByCode(inviteCode);
  }

  async initiateCheckout(hostId: string, inviteCode: string, splitType: string): Promise<GroupOrder> {
    const rawOrder = await this.groupOrderModel.findOne({ inviteCode });
    if (!rawOrder) throw new NotFoundException('Group order not found');

    if (rawOrder.host.toString() !== hostId.toString()) {
      throw new BadRequestException('Only the host can initiate checkout');
    }

    if (rawOrder.status !== 'open') {
      throw new BadRequestException('Group order must be open to initiate checkout');
    }

    rawOrder.status = 'locked';
    rawOrder.splitType = splitType;
    if (splitType === 'sponsor') {
      rawOrder.sponsorId = hostId as any;
    }
    
    await rawOrder.save();

    const populated = await this.findByCode(inviteCode);
    this.gateway.broadcastStatusChanged(inviteCode, 'locked');
    this.gateway.broadcastUpdate(inviteCode, populated);

    return populated;
  }

  async checkout(userId: string, inviteCode: string, paymentReference?: string): Promise<GroupOrder> {
    const rawOrder = await this.groupOrderModel.findOne({ inviteCode });
    if (!rawOrder) throw new NotFoundException('Group order not found');
    
    if (rawOrder.status !== 'locked' && rawOrder.status !== 'open') {
      throw new BadRequestException('Group order is already completed or cancelled');
    }

    // If splitType is sponsor, only the sponsor can checkout
    if (rawOrder.splitType === 'sponsor' && rawOrder.sponsorId.toString() !== userId.toString()) {
      throw new BadRequestException('Only the sponsor can checkout this group order');
    }

    // Find the participant
    const participantIndex = rawOrder.participants.findIndex(
      (p) => p.user.toString() === userId.toString()
    );

    if (rawOrder.splitType === 'split_bill') {
      if (participantIndex === -1) {
        throw new BadRequestException('You are not a participant in this group order');
      }
      if (rawOrder.participants[participantIndex].items.length === 0) {
        throw new BadRequestException('Your cart is empty');
      }
      // Mark as paid
      rawOrder.participants[participantIndex].hasPaid = true;
      await rawOrder.save();
      
      const updatedOrder = await this.findByCode(inviteCode);
      this.gateway.broadcastUpdate(inviteCode, updatedOrder);
      this.gateway.broadcastPaymentProgress(inviteCode, updatedOrder);

      // Check if all active participants have paid
      const activeParticipants = rawOrder.participants.filter(p => p.items.length > 0);
      const allPaid = activeParticipants.every(p => p.hasPaid);

      if (!allPaid) {
        return updatedOrder; // Return early, don't finalize yet
      }
    } else {
      // If sponsor, mark everyone as paid
      rawOrder.participants.forEach(p => {
        if (p.items.length > 0) p.hasPaid = true;
      });
    }

    // If we reach here, either it's sponsor, or split_bill and everyone has paid.
    // Convert into real Orders
    const readyParticipants = rawOrder.participants.filter(p => p.items.length > 0);
    const createdOrderIds: Types.ObjectId[] = [];
    
    for (const participant of readyParticipants) {
      const orderData = {
        vendorId: rawOrder.vendor.toString(),
        items: participant.items.map(item => ({
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          customizations: item.customizations,
          subtotal: item.price * item.quantity
        })),
        deliveryOption: 'use_an_errander',
        paymentReference, // In split_bill, each would theoretically have their own. For simplicity, we might just pass the last one or save it elsewhere.
        groupId: rawOrder._id.toString(),
        isGroupOrder: true,
      };

      const order = await this.ordersService.create(participant.user.toString(), orderData);
      createdOrderIds.push(order._id as Types.ObjectId);
    }

    rawOrder.status = 'completed';
    rawOrder.orders = createdOrderIds;
    await rawOrder.save();

    const populated = await this.findByCode(inviteCode);
    this.gateway.broadcastStatusChanged(inviteCode, 'completed');
    this.gateway.broadcastUpdate(inviteCode, populated);

    return populated;
  }

  async delete(hostId: string, inviteCode: string): Promise<void> {
    const groupOrder = await this.groupOrderModel.findOne({ inviteCode });
    if (!groupOrder) throw new NotFoundException('Group order not found');
    
    if (groupOrder.host.toString() !== hostId.toString()) {
      throw new BadRequestException('Only the host can cancel the group order');
    }

    await this.groupOrderModel.deleteOne({ inviteCode });
    this.gateway.broadcastStatusChanged(inviteCode, 'cancelled');
  }
}
