import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { GroupOrder, GroupOrderDocument } from './schemas/group-order.schema';

@Injectable()
export class GroupOrdersService {
  constructor(
    @InjectModel(GroupOrder.name) private groupOrderModel: Model<GroupOrderDocument>,
  ) {}

  async create(hostId: string, vendorId: string, name?: string, spendingLimit?: number): Promise<GroupOrder> {
    const inviteCode = uuidv4().slice(0, 8).toUpperCase();
    const groupOrder = await this.groupOrderModel.create({
      host: new Types.ObjectId(hostId),
      vendor: new Types.ObjectId(vendorId),
      inviteCode,
      name,
      spendingLimit,
      participants: [
        {
          user: new Types.ObjectId(hostId),
          items: [],
          isReady: false,
        },
      ],
    });
    return groupOrder;
  }

  async findByCode(inviteCode: string): Promise<GroupOrderDocument> {
    const groupOrder = await this.groupOrderModel.findOne({ inviteCode })
      .populate('vendor', 'storeName logo banner')
      .populate('host', 'firstName lastName avatar')
      .populate('participants.user', 'firstName lastName avatar');
    
    if (!groupOrder) throw new NotFoundException('Group order not found');
    return groupOrder;
  }

  async join(userId: string, inviteCode: string): Promise<GroupOrder> {
    const groupOrder = await this.findByCode(inviteCode);
    if (groupOrder.status !== 'open') {
      throw new BadRequestException('This group order is no longer accepting participants');
    }

    const isParticipant = groupOrder.participants.some(
      (p) => p.user['_id'].toString() === userId || p.user.toString() === userId,
    );

    if (!isParticipant) {
      groupOrder.participants.push({
        user: new Types.ObjectId(userId) as any,
        items: [],
        isReady: false,
      });
      await groupOrder.save();
    }

    return this.findByCode(inviteCode);
  }

  async updateItems(userId: string, inviteCode: string, items: any[]): Promise<GroupOrder> {
    const groupOrder = await this.groupOrderModel.findOne({ inviteCode });
    if (!groupOrder) throw new NotFoundException('Group order not found');
    if (groupOrder.status !== 'open') {
      throw new BadRequestException('Cannot update items in a locked or completed order');
    }

    const participantIndex = groupOrder.participants.findIndex(
      (p) => p.user.toString() === userId,
    );

    if (participantIndex === -1) {
      throw new BadRequestException('User is not a participant in this group order');
    }

    groupOrder.participants[participantIndex].items = items;
    await groupOrder.save();
    return this.findByCode(inviteCode);
  }

  async updateStatus(hostId: string, inviteCode: string, status: string): Promise<GroupOrder> {
    const groupOrder = await this.groupOrderModel.findOne({ inviteCode });
    if (!groupOrder) throw new NotFoundException('Group order not found');
    
    if (groupOrder.host.toString() !== hostId) {
      throw new BadRequestException('Only the host can update the group order status');
    }

    groupOrder.status = status;
    await groupOrder.save();
    return this.findByCode(inviteCode);
  }

  async delete(hostId: string, inviteCode: string): Promise<void> {
    const groupOrder = await this.groupOrderModel.findOne({ inviteCode });
    if (!groupOrder) throw new NotFoundException('Group order not found');
    
    if (groupOrder.host.toString() !== hostId) {
      throw new BadRequestException('Only the host can cancel the group order');
    }

    await this.groupOrderModel.deleteOne({ inviteCode });
  }
}
