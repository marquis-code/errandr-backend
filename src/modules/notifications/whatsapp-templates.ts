export interface OrderTemplateData {
  orderNumber: string;
  customerName?: string;
  storeName?: string;
  total?: number;
  items?: Array<{ name?: string; quantity?: number; price?: number }>;
  deliveryAddress?: string;
  deliveryPin?: string;
  ninjaName?: string;
  ninjaPhone?: string;
  prepTimeMinutes?: number;
  delayMinutes?: number;
  delayReason?: string;
  cancellationReason?: string;
  refundStatus?: string;
  paymentMethod?: string;
  customerPhone?: string;
  vendorPhone?: string;
}

export class WhatsAppTemplates {
  private static readonly DIVIDER = '━━━━━━━━━━━━━━━━━━━━━━';
  private static readonly SUPPORT_LINE = '💬 *Questions or updates?* Reply directly to this WhatsApp message or call Erranders Support.';

  /**
   * Helper to format items list concisely
   */
  private static formatItems(items?: Array<{ name?: string; quantity?: number }>): string {
    if (!items || items.length === 0) return '• Standard order package';
    return items
      .map(i => `• ${i.quantity || 1}x ${i.name || 'Item'}`)
      .join('\n');
  }

  /**
   * 1. Order Placed / Payment Received
   */
  static orderPlaced(data: OrderTemplateData): string {
    const name = data.customerName || 'Valued Customer';
    const store = data.storeName || 'Campus Store';
    const total = (data.total || 0).toLocaleString();
    const itemsList = this.formatItems(data.items);
    const dest = data.deliveryAddress || 'Hostel address provided';

    return `🛍️ *ERRANDERS CAMPUS DISPATCH*
${this.DIVIDER}
👋 Hi *${name}*, your order has been received and confirmed!

🧾 *Order #${data.orderNumber}*
🏪 *Store:* ${store}
💰 *Total Paid:* ₦${total}

📦 *Items Ordered:*
${itemsList}

📍 *Delivery To:* ${dest}
⏳ *Status:* 🟡 *Sent to vendor for preparation*

${this.DIVIDER}
🛵 A verified student Errand Ninja will pick up your package and deliver directly to your hostel room.
${this.SUPPORT_LINE}`;
  }

  /**
   * 2. Order Confirmed & In Kitchen Preparation
   */
  static orderPreparing(data: OrderTemplateData): string {
    const name = data.customerName || 'Valued Customer';
    const store = data.storeName || 'Vendor';
    const prep = data.prepTimeMinutes ? ` (~${data.prepTimeMinutes} mins)` : '';

    return `🍳 *ERRANDERS ORDER UPDATE*
${this.DIVIDER}
Hi *${name}*, *${store}* has accepted your order and started preparing it!

🧾 *Order #${data.orderNumber}*
🔥 *Status:* 👨‍🍳 *In the Kitchen / Packaging*${prep}
📍 *Destination:* ${data.deliveryAddress || 'Hostel'}

${this.DIVIDER}
We will notify you on WhatsApp the moment your Errand Ninja collects your order.
${this.SUPPORT_LINE}`;
  }

  /**
   * 3. Order Ready for Pickup / Ninja Assigned
   */
  static orderReady(data: OrderTemplateData): string {
    const name = data.customerName || 'Valued Customer';
    const store = data.storeName || 'Vendor';

    return `📦 *ORDER READY FOR PICKUP*
${this.DIVIDER}
Hi *${name}*, your package from *${store}* is ready and packed.

🧾 *Order #${data.orderNumber}*
🛵 *Status:* A nearby Errand Ninja is arriving at the counter now for instant pickup.

${this.DIVIDER}
${this.SUPPORT_LINE}`;
  }

  /**
   * 4. Errand Ninja Picked Up & On The Way (Includes Delivery PIN!)
   */
  static orderPickedUp(data: OrderTemplateData): string {
    const name = data.customerName || 'Valued Customer';
    const store = data.storeName || 'Vendor';
    const ninja = data.ninjaName ? `*${data.ninjaName}*` : 'An Errand Ninja';
    const phone = data.ninjaPhone ? ` (${data.ninjaPhone})` : '';
    const pin = data.deliveryPin ? `*${data.deliveryPin}*` : 'N/A';

    return `🛵 *ERRAND NINJA ON THE WAY!*
${this.DIVIDER}
Hi *${name}*, ${ninja} has collected your order from *${store}* and is heading to your hostel!

🧾 *Order #${data.orderNumber}*
📍 *Delivering To:* ${data.deliveryAddress || 'Your hostel'}
👤 *Rider:* ${ninja}${phone}

🔐 *YOUR 4-DIGIT DELIVERY PIN:*
👉 ${pin} 👈
_⚠️ IMPORTANT: Only share this 4-digit PIN with your Errand Ninja when they hand over your package to verify receipt._

${this.DIVIDER}
Please keep your phone handy in case the rider needs gate clearance.
${this.SUPPORT_LINE}`;
  }

  /**
   * 5. In Transit / Close to Hostel
   */
  static orderInTransit(data: OrderTemplateData): string {
    const name = data.customerName || 'Valued Customer';
    const ninja = data.ninjaName || 'Your rider';
    const phone = data.ninjaPhone ? ` at *${data.ninjaPhone}*` : '';
    const pin = data.deliveryPin ? `*${data.deliveryPin}*` : 'N/A';

    return `📍 *RIDER ARRIVING SHORTLY*
${this.DIVIDER}
Hi *${name}*, ${ninja} is approaching your hostel (${data.deliveryAddress || 'Hostel'})!

🧾 *Order #${data.orderNumber}*
🔑 *Delivery PIN:* ${pin}
📞 Need directions? Call your Ninja${phone}.

${this.DIVIDER}
Get ready to collect your delivery!`;
  }

  /**
   * 6. Order Delivered Successfully
   */
  static orderDelivered(data: OrderTemplateData): string {
    const name = data.customerName || 'Valued Customer';
    const store = data.storeName || 'Vendor';

    return `🎉 *DELIVERY COMPLETE!*
${this.DIVIDER}
Hi *${name}*, your order *#${data.orderNumber}* from *${store}* has been successfully delivered!

Enjoy your order! Thank you for choosing Erranders.

⭐ *Rate Your Experience:*
Log in to the Erranders web app to review your meal and tip your student Errand Ninja.

${this.DIVIDER}
Have an amazing day! 🚀`;
  }

  /**
   * 7. Order Cancelled
   */
  static orderCancelled(data: OrderTemplateData): string {
    const name = data.customerName || 'Valued Customer';
    const reason = data.cancellationReason || 'Requested or unfulfilled order';
    const refund = data.refundStatus || 'Processed automatically to your wallet/account';

    return `❌ *ORDER CANCELLED*
${this.DIVIDER}
Hi *${name}*, order *#${data.orderNumber}* could not be completed and has been cancelled.

📝 *Reason:* ${reason}
💳 *Refund Status:* ${refund}

${this.DIVIDER}
We apologize for any inconvenience. If you have questions, reply directly to this message to chat with support.`;
  }

  /**
   * 8. Proactive Order Delay Alert
   */
  static orderDelayed(data: OrderTemplateData): string {
    const name = data.customerName || 'Valued Customer';
    const store = data.storeName || 'Vendor';
    const delay = data.delayMinutes || 10;
    const reason = data.delayReason || 'High order volume at vendor kitchen';

    return `⚠️ *ERRANDERS DELIVERY NOTICE*
${this.DIVIDER}
Hi *${name}*, we noticed your order *#${data.orderNumber}* from *${store}* is experiencing a brief delay.

⏱️ *Estimated Additional Time:* ~${delay} minutes
📝 *Reason:* ${reason}

Our campus operations desk is actively tracking this order and expediting your Errand Ninja to ensure your package arrives hot and fresh.

We truly appreciate your patience!
${this.SUPPORT_LINE}`;
  }

  /**
   * 9. Customer Service Desk: New Order Alert
   */
  static customerServiceNewOrder(data: OrderTemplateData): string {
    const itemsList = this.formatItems(data.items);
    const total = (data.total || 0).toLocaleString();
    const custPhone = data.customerPhone || 'N/A';
    const vendPhone = data.vendorPhone ? ` (${data.vendorPhone})` : '';
    const pay = data.paymentMethod || 'Paid (Online)';

    return `🚨 *NEW CAMPUS ORDER — CS DESK ALERT*
${this.DIVIDER}
Order *#${data.orderNumber}* has been placed and requires operational monitoring!

🏪 *Vendor:* ${data.storeName || 'Vendor'}${vendPhone}
👤 *Customer:* ${data.customerName || 'Customer'} (${custPhone})
📍 *Destination:* ${data.deliveryAddress || 'Hostel'}
💰 *Amount:* ₦${total} [${pay}]

📦 *Items:*
${itemsList}

${this.DIVIDER}
⚡ *Action Required:* Ensure vendor accepts and runner is assigned within 3 mins.`;
  }

  /**
   * 10. Customer Service Desk: Order Delay Escalation
   */
  static customerServiceDelayAlert(data: OrderTemplateData): string {
    const delay = data.delayMinutes || 10;
    const reason = data.delayReason || 'Unattended / Prep delay';

    return `⚠️ *CS ESCALATION: ORDER DELAY DETECTED*
${this.DIVIDER}
Order *#${data.orderNumber}* is exceeding target delivery window!

🏪 *Vendor:* ${data.storeName || 'Vendor'} (${data.vendorPhone || 'N/A'})
👤 *Customer:* ${data.customerName || 'Customer'} (${data.customerPhone || 'N/A'})
⏱️ *Reported Delay:* +${delay} minutes
📝 *Reason:* ${reason}
🛵 *Rider Assigned:* ${data.ninjaName || 'None'} (${data.ninjaPhone || 'N/A'})

${this.DIVIDER}
⚡ *Action Required:* Call vendor or re-assign priority Errand Ninja immediately.`;
  }

  /**
   * 11. Inbound Customer Reply Forwarded to Support
   */
  static customerInboundMessageToSupport(customerPhone: string, text: string): string {
    return `💬 *CUSTOMER WHATSAPP INBOUND — CS DESK*
${this.DIVIDER}
A customer sent a reply via WhatsApp:

👤 *From:* ${customerPhone}
📩 *Message:*
"${text}"

${this.DIVIDER}
⚡ *Action:* Respond to customer or review their active order.`;
  }

  /**
   * 12. Broadcast to Errand Ninja: New Errand Available
   * Dynamic, highly engaging, and time-aware to motivate Errand Ninjas on campus
   */
  static errandAvailableForNinja(data: { storeName: string; orderNumber: string; deliveryFee: number }): string {
    // Current hour in Nigeria (WAT = UTC+1)
    const currentHourWAT = (new Date().getUTCHours() + 1) % 24;

    let timeGreetingHeader = '🚨 *NEW ERRAND MISSION!* 🛵⚡';
    let motivationalHook = 'A student on campus needs their order delivered right now!';
    let hypeKicker = 'Fatigue is temporary, cash in your wallet is forever! 💸 Keep the momentum going!';

    if (currentHourWAT >= 5 && currentHourWAT < 12) {
      // Morning (5:00 AM - 11:59 AM)
      timeGreetingHeader = '🌅 *MORNING BAG ALERT!* 💸 🛵';
      motivationalHook = 'Start your morning with guaranteed cash! While others are still waking up, secure your daily bag early.';
      hypeKicker = 'Rise, grind, and stack those delivery fees before noon! 🚀';
    } else if (currentHourWAT >= 12 && currentHourWAT < 17) {
      // Afternoon (12:00 PM - 4:59 PM)
      timeGreetingHeader = '☀️ *AFTERNOON RUSH — QUICK CASH!* ⚡ 🛵';
      motivationalHook = 'Lunchtime rush is hot! We know you’ve been moving, but this quick drop is calling your name.';
      hypeKicker = 'Push through the afternoon fatigue — another easy win in the bag! 🏆';
    } else if (currentHourWAT >= 17 && currentHourWAT < 22) {
      // Evening (5:00 PM - 9:59 PM)
      timeGreetingHeader = '🌆 *EVENING BAG UNLOCKED!* 💰 🛵';
      motivationalHook = 'Dinner orders are flying in! Knock out this fast campus delivery before you wrap up your day.';
      hypeKicker = 'Finish today’s shift strong and boost tonight’s total earnings! ✨';
    } else {
      // Late Night / Early Hours (10:00 PM - 4:59 AM)
      timeGreetingHeader = '🌙 *NIGHT OWL NINJA MISSION!* 🦉 🛵';
      motivationalHook = 'Late-night campus cravings! Fast pickup, clear roads, and zero campus foot traffic.';
      hypeKicker = 'Easy money for the dedicated Errand Ninja on duty! 🌟';
    }

    const feeFormatted = (data.deliveryFee || 300).toLocaleString();

    return `${timeGreetingHeader}
${this.DIVIDER}
${motivationalHook}

🏪 *Pickup Store:* ${data.storeName}
🧾 *Order:* #${data.orderNumber}
💰 *Your Earning:* ₦${feeFormatted}

💡 _${hypeKicker}_

⚡ *Open your Errand Ninja app now to claim this order before another Errand Ninja takes it!*`;
  }

  /**
   * 13. Order Assigned to Errand Ninja
   */
  static orderAssignedToNinja(data: {
    ninjaName?: string;
    orderNumber: string;
    storeName: string;
    deliveryAddress: string;
    deliveryFee: number;
    itemsCount?: number;
  }): string {
    const name = data.ninjaName || 'Ninja';
    return `🛵 *ERRAND NINJA: ORDER ASSIGNED!* 📦
${this.DIVIDER}
👋 Hi *${name}*, you have claimed order *#${data.orderNumber}*!

🏪 *Pickup Store:* ${data.storeName}
📍 *Deliver To:* ${data.deliveryAddress}
🛍️ *Items:* ${data.itemsCount || 1} item(s)
💰 *Your Earnings:* ₦${data.deliveryFee.toLocaleString()}

⚡ *Next Steps:*
1. Head to the store to collect the package.
2. Deliver to the customer's hostel/location.
3. Ask the customer for their *4-digit Delivery PIN* to complete delivery.`;
  }
}
