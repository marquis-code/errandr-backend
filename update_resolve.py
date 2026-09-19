import re

with open("src/modules/orders/orders.service.ts", "r") as f:
    content = f.read()

replacement = """  async resolveItemSubstitute(orderId: string, itemId: string, accept: boolean, substituteItemId: string, userId: string, itemName?: string) {
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
    let originalItemPrice = 0;
    let quantity = 1;
    const jsonOrder = order.toJSON();
    
    const matches = (item: any) => {
      if (!item) return false;
      const id1 = item._id?.toString();
      const id2 = item.menuItem?.toString();
      const id3 = item.product?.toString();
      if (id1 === itemId || id2 === itemId || id3 === itemId) return true;
      if (itemName && item.name?.toLowerCase() === itemName.toLowerCase()) return true;
      return false;
    };
    
    if (!itemFound && jsonOrder.menuItems) {
      const idx = jsonOrder.menuItems.findIndex((i: any) => matches(i));
      if (idx !== -1) {
        const jsonItem = jsonOrder.menuItems[idx];
        const docItem = order.menuItems[idx] as any;
        if (docItem.status === 'unavailable' || docItem.status === 'substituted') {
          throw new BadRequestException('Item already handled');
        }
        originalItemPrice = jsonItem.price || 0;
        quantity = jsonItem.quantity || 1;
        
        docItem.status = 'substituted';
        docItem.substitutedWith = { menuItem: substituteObj._id, name: substituteObj.name };
        docItem.name = `${substituteObj.name} (Substituted for ${jsonItem.name})`;
        docItem.price = substituteObj.price;
        docItem.subtotal = substituteObj.price * quantity;
        itemFound = true;
      }
    }

    if (!itemFound && jsonOrder.items) {
      const idx = jsonOrder.items.findIndex((i: any) => matches(i));
      if (idx !== -1) {
        const jsonItem = jsonOrder.items[idx];
        const docItem = order.items[idx] as any;
        if (docItem.status === 'unavailable' || docItem.status === 'substituted') {
          throw new BadRequestException('Item already handled');
        }
        originalItemPrice = jsonItem.price || 0;
        quantity = jsonItem.quantity || 1;
        
        docItem.status = 'substituted';
        docItem.substitutedWith = { product: substituteObj._id, name: substituteObj.name };
        docItem.name = `${substituteObj.name} (Substituted for ${jsonItem.name})`;
        docItem.price = substituteObj.price;
        docItem.subtotal = substituteObj.price * quantity;
        itemFound = true;
      }
    }

    if (!itemFound && jsonOrder.packs) {
      for (let pIdx = 0; pIdx < jsonOrder.packs.length; pIdx++) {
        const pack = jsonOrder.packs[pIdx];
        if (!pack.items) continue;
        const idx = pack.items.findIndex((i: any) => matches(i));
        if (idx !== -1) {
          const jsonItem = pack.items[idx];
          const docItem = (order.packs as any)[pIdx].items[idx] as any;
          if (docItem.status === 'unavailable' || docItem.status === 'substituted') {
            throw new BadRequestException('Item already handled');
          }
          originalItemPrice = jsonItem.price || 0;
          quantity = jsonItem.quantity || 1;
          
          docItem.status = 'substituted';
          docItem.substitutedWith = { product: substituteObj._id, name: substituteObj.name };
          docItem.name = `${substituteObj.name} (Substituted for ${jsonItem.name})`;
          docItem.price = substituteObj.price;
          docItem.subtotal = substituteObj.price * quantity;
          
          // Re-calculate pack subtotal
          const packItems = (order.packs as any)[pIdx].items;
          const newPackSubtotal = packItems.reduce((acc, curr) => acc + (curr.subtotal || 0), 0);
          (order.packs as any)[pIdx].subtotal = newPackSubtotal;
          
          itemFound = true;
          break;
        }
      }
    }

    if (!itemFound) throw new NotFoundException('Original item not found in order');

    const originalSubtotal = originalItemPrice * quantity;
    const newSubtotal = substituteObj.price * quantity;
    const priceDiff = newSubtotal - originalSubtotal;

    // Handle Financial Implications
    if (priceDiff > 0) {
      // Must charge extra
      const wallet = await this.walletsService.getWallet(order.customer.toString());
      if (!wallet || wallet.balance < priceDiff) {
        throw new HttpException('PaymentRequired: Insufficient wallet balance to cover the substitute difference.', 402);
      }
      // Debit student
      await this.walletsService.debitWallet(
        order.customer.toString(),
        priceDiff,
        `Extra charge for substitute item: ${substituteObj.name}`,
        order._id.toString()
      );
    } else if (priceDiff < 0) {
      // Refund difference
      const refundAmount = Math.abs(priceDiff);
      await this.walletsService.creditWallet(
        order.customer.toString(),
        refundAmount,
        `Refund for cheaper substitute item: ${substituteObj.name}`,
        'refund',
        order._id.toString()
      );
    }

    // Update order totals
    if (priceDiff !== 0) {
      order.subtotal += priceDiff;
      order.total += priceDiff;
      
      // Update vendor share if already paid
      if (order.vendor) {
        const fullOrder = await this.orderModel.findById(orderId).populate('vendor');
        if (fullOrder && fullOrder.vendor) {
          const ownerId = (fullOrder.vendor as any).owner;
          if (ownerId) {
            const markupPct = fullOrder.foodMarkupPercentage || 5;
            const vendorDiffShare = Math.round(priceDiff / (1 + (markupPct / 100)));
            order.vendorShare = Math.max(0, (order.vendorShare || 0) + vendorDiffShare);
            order.platformShare = Math.max(0, (order.platformShare || 0) + (priceDiff - vendorDiffShare));
            
            if (order.paymentStatus === 'paid') {
              if (priceDiff > 0) {
                // Credit vendor the extra
                await this.walletsService.creditWallet(
                  ownerId.toString(),
                  vendorDiffShare,
                  `Additional payment for substitute in Order #${order.orderNumber}`,
                  'credit',
                  order._id.toString()
                ).catch(() => {});
              } else {
                // Debit vendor the refund
                await this.walletsService.debitWallet(
                  ownerId.toString(),
                  Math.abs(vendorDiffShare),
                  `Reversal for cheaper substitute in Order #${order.orderNumber}`,
                  order._id.toString()
                ).catch(() => {});
              }
            }
          }
        }
      }
    }

    await order.save();

    if (order.errander) {
      this.notificationsService.sendNotification(order.errander.toString(), {
        title: 'Substitute Accepted ✅',
        body: `The student accepted the substitute: ${substituteObj.name}`,
        type: 'substitute_accepted',
        data: { orderId: order._id.toString() }
      }).catch(() => {});
      
      this.notificationsGateway.sendToUser(order.errander.toString(), {
        type: 'SUBSTITUTE_RESOLVED',
        title: 'Substitute Accepted',
        body: `Student accepted ${substituteObj.name}`,
        data: { orderId: order._id }
      });
    }

    return order;"""

pattern = re.compile(r'  async resolveItemSubstitute\(.*?return order;\n', re.DOTALL)
new_content = pattern.sub(replacement + "\n", content)

with open("src/modules/orders/orders.service.ts", "w") as f:
    f.write(new_content)
