const fs = require('fs');
const path = './src/modules/orders/orders.service.ts';
let code = fs.readFileSync(path, 'utf8');

const oldMethod = /async resolveItemSubstitute[^]+?throw new BadRequestException\('Please provide substituteItemId to resolve'\);\s*\n\s*\}/m;

const newMethod = `async resolveItemSubstitute(orderId: string, itemId: string, accept: boolean, substituteItemId: string, userId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.customer?.toString() !== userId) throw new BadRequestException('Only student can resolve substitute');

    if (!accept) {
      return this.markItemUnavailable(orderId, itemId, userId);
    }

    if (!substituteItemId) throw new BadRequestException('Substitute item id is required');

    // Handle acceptance
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
        // Swap name for display purposes (price remains the same)
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
            product: substituteObj._id,
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

    // Notify Errander
    if (order.errander) {
      this.notificationsService.sendPushNotification(
        order.errander.toString(),
        'Substitute Accepted ✅',
        \`The student accepted the substitute: \${substituteObj.name}\`,
        { type: 'substitute_accepted', orderId: order._id.toString() }
      ).catch(() => {});
      
      this.notificationsGateway.sendNotificationToUser(order.errander.toString(), {
        type: 'SUBSTITUTE_RESOLVED',
        title: 'Substitute Accepted',
        message: \`Student accepted \${substituteObj.name}\`,
        payload: { orderId: order._id }
      });
    }

    return order;
  }`;

if (oldMethod.test(code)) {
  code = code.replace(oldMethod, newMethod);
  fs.writeFileSync(path, code);
  console.log('Successfully updated resolveItemSubstitute');
} else {
  console.log('Method not found in file');
}
