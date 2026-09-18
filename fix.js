const fs = require('fs');
const path = './src/modules/orders/orders.service.ts';
let code = fs.readFileSync(path, 'utf8');

const newMethods = `
  async markItemUnavailable(orderId: string, itemId: string, userId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.errander?.toString() !== userId && order.customer?.toString() !== userId) {
      throw new BadRequestException('Unauthorized');
    }

    let itemFound = false;
    let refundedAmount = 0;
    
    for (const item of order.menuItems) {
      if ((item as any)._id?.toString() === itemId || item.menuItem?.toString() === itemId) {
        if (item.status === 'unavailable') throw new BadRequestException('Item already marked unavailable');
        item.status = 'unavailable';
        itemFound = true;
        refundedAmount = item.subtotal;
        await this.menuItemModel.findByIdAndUpdate(item.menuItem, { isAvailable: false }).catch(() => {});
        break;
      }
    }
    
    if (!itemFound) {
      for (const item of order.items) {
        if ((item as any)._id?.toString() === itemId || item.product?.toString() === itemId) {
          if (item.status === 'unavailable') throw new BadRequestException('Item already marked unavailable');
          item.status = 'unavailable';
          itemFound = true;
          refundedAmount = item.subtotal;
          await this.productModel.findByIdAndUpdate(item.product, { isAvailable: false }).catch(() => {});
          break;
        }
      }
    }
    
    if (!itemFound) throw new NotFoundException('Item not found in order');

    order.subtotal -= refundedAmount;
    order.total -= refundedAmount;
    
    if (refundedAmount > 0) {
      const customer = await this.userModel.findById(order.customer);
      if (customer) {
        await this.walletsService.creditWallet(
          customer._id.toString(),
          refundedAmount,
          \`Refund for unavailable item in Order #\${order.orderNumber}\`,
          'refund',
          order._id.toString()
        );
        
        this.notificationsService.sendNotification(customer._id.toString(), {
          title: 'Item Refunded 💸',
          body: \`An item was out of stock. ₦\${refundedAmount} has been instantly refunded to your Erranders Wallet!\`,
          type: 'order_refund',
          payload: { orderId: order._id.toString() }
        }).catch(() => {});
      }
    }

    await order.save();
    
    const otherParty = order.errander?.toString() === userId ? order.customer?.toString() : order.errander?.toString();
    if (otherParty) {
      this.notificationsGateway.sendToUser(otherParty, {
        type: 'ORDER_UPDATED',
        title: 'Order Updated',
        body: 'An item was marked unavailable.',
        data: { orderId: order._id }
      });
    }

    return order;
  }

  async requestItemSubstitute(orderId: string, itemId: string, substituteItemId: string, userId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.errander?.toString() !== userId) throw new BadRequestException('Only errander can suggest substitute');

    let originalItemName = '';
    let substituteName = '';
    
    const substituteMenu = await this.menuItemModel.findById(substituteItemId);
    const substituteProd = await this.productModel.findById(substituteItemId);
    const substituteObj = substituteMenu || substituteProd;
    
    if (!substituteObj) throw new NotFoundException('Substitute item not found in store');
    if ((substituteObj as any).vendor?.toString() !== order.vendor?.toString()) {
      throw new BadRequestException('Substitute must be from the same vendor');
    }
    substituteName = substituteObj.name;

    let itemFound = false;
    for (const item of order.menuItems) {
      if ((item as any)._id?.toString() === itemId || item.menuItem?.toString() === itemId) {
        if (item.price !== (substituteObj as any).price) throw new BadRequestException('Substitute must be the exact same price');
        originalItemName = item.name;
        itemFound = true;
        break;
      }
    }
    
    if (!itemFound) {
      for (const item of order.items) {
        if ((item as any)._id?.toString() === itemId || item.product?.toString() === itemId) {
          if (item.price !== (substituteObj as any).price) throw new BadRequestException('Substitute must be the exact same price');
          originalItemName = item.name;
          itemFound = true;
          break;
        }
      }
    }

    if (!itemFound) throw new NotFoundException('Original item not found in order');

    this.notificationsService.sendNotification(order.customer.toString(), {
      title: 'Substitute Suggested 🔄',
      body: \`\${originalItemName} is out of stock. Your Errander suggested \${substituteName} instead. Please review!\`,
      type: 'substitute_request',
      payload: { orderId: order._id.toString(), itemId, substituteItemId }
    }).catch(() => {});
    
    this.notificationsGateway.sendToUser(order.customer.toString(), {
      type: 'SUBSTITUTE_REQUEST',
      title: 'Review Substitute',
      body: \`\${originalItemName} is unavailable. Accept \${substituteName} instead?\`,
      data: { orderId: order._id, itemId, substituteItemId, originalItemName, substituteName }
    });

    return { success: true, message: 'Substitute request sent to student' };
  }

  async resolveItemSubstitute(orderId: string, itemId: string, accept: boolean, substituteItemId: string, userId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.customer?.toString() !== userId) throw new BadRequestException('Only student can resolve substitute');

    if (!accept) {
      return this.markItemUnavailable(orderId, itemId, userId);
    }

    if (!substituteItemId) throw new BadRequestException('Substitute item id is required');

    const substituteMenu = await this.menuItemModel.findById(substituteItemId);
    const substituteProd = await this.productModel.findById(substituteItemId);
    const substituteObj = substituteMenu || substituteProd;
    
    if (!substituteObj) throw new NotFoundException('Substitute item not found');

    let itemFound = false;
    for (const item of order.menuItems) {
      if ((item as any)._id?.toString() === itemId || item.menuItem?.toString() === itemId) {
        if (item.status === 'unavailable' || item.status === 'substituted') {
          throw new BadRequestException('Item already handled');
        }
        item.status = 'substituted';
        item.substitutedWith = {
          menuItem: substituteObj._id,
          name: substituteObj.name
        };
        item.name = \`\${substituteObj.name} (Substituted for \${item.name})\`;
        itemFound = true;
        break;
      }
    }
    
    if (!itemFound) {
      for (const item of order.items) {
        if ((item as any)._id?.toString() === itemId || item.product?.toString() === itemId) {
          if (item.status === 'unavailable' || item.status === 'substituted') {
            throw new BadRequestException('Item already handled');
          }
          item.status = 'substituted';
          item.substitutedWith = {
            product: substituteObj._id as any,
            name: substituteObj.name
          };
          item.name = \`\${substituteObj.name} (Substituted for \${item.name})\`;
          itemFound = true;
          break;
        }
      }
    }

    if (!itemFound) throw new NotFoundException('Original item not found in order');

    await order.save();

    if (order.errander) {
      this.notificationsService.sendNotification(order.errander.toString(), {
        title: 'Substitute Accepted ✅',
        body: \`The student accepted the substitute: \${substituteObj.name}\`,
        type: 'substitute_accepted',
        payload: { orderId: order._id.toString() }
      }).catch(() => {});
      
      this.notificationsGateway.sendToUser(order.errander.toString(), {
        type: 'SUBSTITUTE_RESOLVED',
        title: 'Substitute Accepted',
        body: \`Student accepted \${substituteObj.name}\`,
        data: { orderId: order._id }
      });
    }

    return order;
  }
`;

const lastBraceIndex = code.lastIndexOf('}');
if (lastBraceIndex !== -1) {
  code = code.substring(0, lastBraceIndex) + newMethods + '\n}\n';
  fs.writeFileSync(path, code);
  console.log('Successfully injected correctly.');
}
