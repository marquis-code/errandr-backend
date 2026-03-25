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

  async findByCode(inviteCode: string): Promise<GroupOrderDocument> {
    const groupOrder = await this.groupOrderModel.findOne({ inviteCode })
      .populate('vendor', 'storeName logo banner deliveryFee packagingFee')
      .populate('host', 'firstName lastName avatar')
      .populate('participants.user', 'firstName lastName avatar');
    
    if (!groupOrder) throw new NotFoundException('Group order not found');
    return groupOrder;
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
      });
      await groupOrder.save();
      
      const populated = await this.findByCode(inviteCode);
      const newUser = populated.participants.find(p => p.user['_id'].toString() === userIdStr)?.user;
      this.gateway.broadcastMemberJoined(inviteCode, newUser);
      return populated;
    }

    return this.findByCode(inviteCode);
  }

  async updateItems(userId: string, inviteCode: string, items: any[]): Promise<GroupOrder> {
    const groupOrder = await this.groupOrderModel.findOne({ inviteCode });
    if (!groupOrder) throw new NotFoundException('Group order not found');
    
    if (groupOrder.status !== 'open') {
      throw new BadRequestException('Cannot update items in a locked or completed order');
    }

    const userIdStr = userId.toString();
    const participantIndex = groupOrder.participants.findIndex(
      (p) => p.user.toString() === userIdStr
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
      (p) => p.user.toString() === userIdStr
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

  async checkout(hostId: string, inviteCode: string, paymentReference?: string): Promise<GroupOrder> {
    const groupOrder = await this.findByCode(inviteCode);
    if (!groupOrder) throw new NotFoundException('Group order not found');
    
    if (groupOrder.host['_id'].toString() !== hostId.toString()) {
      throw new BadRequestException('Only the host can checkout the group order');
    }

    if (groupOrder.status !== 'open' && groupOrder.status !== 'locked') {
      throw new BadRequestException('Group order is already completed or cancelled');
    }

    const readyParticipants = groupOrder.participants.filter(p => p.items.length > 0);
    if (readyParticipants.length === 0) {
      throw new BadRequestException('No participants have items in their cart');
    }

    // Convert into real Orders
    const createdOrderIds: Types.ObjectId[] = [];
    
    for (const participant of readyParticipants) {
      const orderData = {
        vendorId: groupOrder.vendor['_id'].toString(),
        items: participant.items.map(item => ({
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          customizations: item.customizations,
          subtotal: item.price * item.quantity
        })),
        deliveryOption: 'use_an_errander',
        paymentReference, // If host pays for all, or we handle individual payments later
        groupId: groupOrder._id.toString(),
        isGroupOrder: true,
      };

      const order = await this.ordersService.create(participant.user['_id'].toString(), orderData);
      createdOrderIds.push(order._id as Types.ObjectId);
    }

    groupOrder.status = 'completed';
    groupOrder.orders = createdOrderIds;
    await groupOrder.save();

    this.gateway.broadcastStatusChanged(inviteCode, 'completed');
    this.gateway.broadcastUpdate(inviteCode, groupOrder);

    return groupOrder;
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
