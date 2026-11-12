export interface PayoutReceiptTemplateData {
  recipientName: string;
  role: string;
  amount: number;
  reference: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  paidAt?: Date;
}

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
  private static readonly BOT_HEADER = '🤖 *Erranders Bot*';
  private static readonly BOT_FOOTER = '\n\n💬 Reply here for help.';

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
   * Item names are fine for food and dangerous for medicine.
   *
   * A hostel-gate handover, or a message to a group of riders, announcing the medicine someone
   * bought is a disclosure they never agreed to. Pharmacy orders name the count, never the drugs.
   */
  private static privacySafeItems(
    items?: Array<{ name?: string; quantity?: number; isPharmacy?: boolean }>,
  ): string {
    const count = (items || []).reduce((n, i) => n + (i.quantity || 1), 0) || 0;
    return `• ${count || 'Several'} item${count === 1 ? '' : 's'} (names hidden for privacy)`;
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

    return `${this.BOT_HEADER}
Hi ${name}, your order is confirmed.

#${data.orderNumber} · ${store} · ₦${total}
${itemsList}
To: ${dest}

We'll message you when a rider collects it.${this.BOT_FOOTER}`;
  }

  /**
   * 1b. Custom Errand Received
   */
  static customErrandReceived(data: OrderTemplateData): string {
    const name = data.customerName || 'Valued Customer';
    const store = data.storeName || 'Custom Pickup Location';
    const total = (data.total || 0).toLocaleString();
    const itemsList = this.formatItems(data.items);
    const dest = data.deliveryAddress || 'Hostel address provided';

    return `${this.BOT_HEADER}
🛍️ *CUSTOM ERRAND MISSION RECEIVED*

👋 Hi *${name}*, your custom errand request has been logged and broadcast to campus Ninjas!

🧾 *Order #${data.orderNumber}*
🏪 *Pickup:* ${store}
📍 *Delivery To:* ${dest}
💰 *Estimated Budget:* ₦${total}

📦 *Items Requested:*
${itemsList}

🛵 Nearby verified student Errand Ninjas have been alerted. You will receive an update once a runner accepts.${this.BOT_FOOTER}`;
  }

  /**
   * 2. Order Confirmed & In Kitchen Preparation
   */
  static orderPreparing(data: OrderTemplateData): string {
    const name = data.customerName || 'Valued Customer';
    const store = data.storeName || 'Vendor';
    const prep = data.prepTimeMinutes ? ` (~${data.prepTimeMinutes} mins)` : '';

    return `${this.BOT_HEADER}
🍳 *KITCHEN PREPARATION STARTED*

Hi *${name}*, *${store}* has accepted your order and started preparing it!

🧾 *Order #${data.orderNumber}*
🔥 *Status:* 👨‍🍳 In Preparation / Packaging${prep}
📍 *Destination:* ${data.deliveryAddress || 'Hostel'}

We will notify you the moment your Errand Ninja collects your package.${this.BOT_FOOTER}`;
  }

  /**
   * 3. Order Ready for Pickup / Ninja Assigned
   */
  static orderReady(data: OrderTemplateData): string {
    const name = data.customerName || 'Valued Customer';
    const store = data.storeName || 'Vendor';

    return `${this.BOT_HEADER}
📦 *ORDER PACKED & READY*

Hi *${name}*, your package from *${store}* is ready and packed.

🧾 *Order #${data.orderNumber}*
🛵 *Status:* An Errand Ninja is arriving at the counter now for pickup.${this.BOT_FOOTER}`;
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

    return `${this.BOT_HEADER}
🛵 *YOUR ERRAND NINJA IS ON THE WAY!*

Hi *${name}*, ${ninja} has collected your order from *${store}* and is heading to your hostel!

🧾 *Order #${data.orderNumber}*
📍 *Delivering To:* ${data.deliveryAddress || 'Your hostel'}
👤 *Rider:* ${ninja}${phone}

🔐 *YOUR 4-DIGIT DELIVERY PIN:*
👉 ${pin} 👈
_⚠️ IMPORTANT: Only share this 4-digit PIN with your Errand Ninja when they hand over your package to verify receipt._

Please keep your phone handy in case the rider needs gate clearance.${this.BOT_FOOTER}`;
  }

  /**
   * 5. In Transit / Close to Hostel
   */
  static orderInTransit(data: OrderTemplateData): string {
    const name = data.customerName || 'Valued Customer';
    const ninja = data.ninjaName || 'Your rider';
    const phone = data.ninjaPhone ? ` at *${data.ninjaPhone}*` : '';
    const pin = data.deliveryPin ? `*${data.deliveryPin}*` : 'N/A';

    return `${this.BOT_HEADER}
📍 *ALMOST AT YOUR HOSTEL!*

Hi *${name}*, ${ninja} is arriving at your hostel (${data.deliveryAddress || 'Hostel'})!

🧾 *Order #${data.orderNumber}*
🔑 *Delivery PIN:* ${pin}
📞 Need directions? Call your Ninja${phone}.

Please be ready to meet your runner and collect your package.${this.BOT_FOOTER}`;
  }

  /**
   * 6. Order Delivered Successfully
   */
  static orderDelivered(data: OrderTemplateData): string {
    const name = data.customerName || 'Valued Customer';
    const store = data.storeName || 'Vendor';

    return `${this.BOT_HEADER}
🎉 *DELIVERY COMPLETED!*

👋 Hi *${name}*, your order *#${data.orderNumber}* from *${store}* has been successfully delivered!

Hope you enjoy it! 💛

⭐ *Rate Your Experience:*
Log in to the Erranders web app to review your meal and tip your student Errand Ninja:${this.BOT_FOOTER}`;
  }

  /**
   * 7. Order Cancelled
   */
  static orderCancelled(data: OrderTemplateData): string {
    const name = data.customerName || 'Valued Customer';
    const reason = data.cancellationReason || 'Requested or unfulfilled order';
    const refund = data.refundStatus || 'Processed automatically to your wallet/account';

    return `${this.BOT_HEADER}
❌ *ORDER CANCELLED*

Hi *${name}*, order *#${data.orderNumber}* could not be completed and has been cancelled.

📝 *Reason:* ${reason}
💳 *Refund Status:* ${refund}

We apologize for the inconvenience. Reply to this chat if you have any questions.${this.BOT_FOOTER}`;
  }

  /**
   * 8. Proactive Order Delay Alert
   */
  static orderDelayed(data: OrderTemplateData): string {
    const name = data.customerName || 'Valued Customer';
    const store = data.storeName || 'Vendor';
    const delay = data.delayMinutes || 10;
    const reason = data.delayReason || 'High order volume at vendor kitchen';

    return `${this.BOT_HEADER}
⚠️ *BRIEF DELIVERY DELAY NOTICE*

Hi *${name}*, your order *#${data.orderNumber}* from *${store}* is experiencing a brief delay.

⏱️ *Estimated Additional Time:* ~${delay} minutes
📝 *Reason:* ${reason}

Our campus operations desk is actively tracking this and expediting your runner. We truly appreciate your patience!${this.BOT_FOOTER}`;
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

    return `${this.BOT_HEADER}
🚨 *CS DESK: NEW ORDER ALERT*

Order *#${data.orderNumber}* requires operational monitoring!

🏪 *Vendor:* ${data.storeName || 'Vendor'}${vendPhone}
👤 *Customer:* ${data.customerName || 'Customer'} (${custPhone})
📍 *Destination:* ${data.deliveryAddress || 'Hostel'}
💰 *Amount:* ₦${total} [${pay}]

📦 *Items:*
${itemsList}

⚡ *Action Required:* Ensure vendor accepts and runner is assigned within 3 mins.${this.BOT_FOOTER}`;
  }

  /**
   * 10. Customer Service Desk: Order Delay Escalation
   */
  static customerServiceDelayAlert(data: OrderTemplateData): string {
    const delay = data.delayMinutes || 10;
    const reason = data.delayReason || 'Unattended / Prep delay';

    return `${this.BOT_HEADER}
⚠️ *CS DESK: ORDER DELAY ESCALATION*

Order *#${data.orderNumber}* is exceeding target delivery window!

🏪 *Vendor:* ${data.storeName || 'Vendor'} (${data.vendorPhone || 'N/A'})
👤 *Customer:* ${data.customerName || 'Customer'} (${data.customerPhone || 'N/A'})
⏱️ *Reported Delay:* +${delay} minutes
📝 *Reason:* ${reason}
🛵 *Rider Assigned:* ${data.ninjaName || 'None'} (${data.ninjaPhone || 'N/A'})

⚡ *Action Required:* Call vendor or re-assign priority Errand Ninja immediately.${this.BOT_FOOTER}`;
  }

  /**
   * 11. Inbound Customer Reply Forwarded to Support
   */
  static customerInboundMessageToSupport(
    customerPhone: string,
    text: string,
    context?: { name?: string; orderNumber?: string; orderStatus?: string },
  ): string {
    const who = context?.name ? `${context.name} (${customerPhone})` : customerPhone;
    const order = context?.orderNumber
      ? `${context.orderNumber}${context.orderStatus ? ' · ' + context.orderStatus : ''}`
      : 'no active order found';

    return `${this.BOT_HEADER}
Customer reply
From: ${who}
Order: ${order}

"${text}"`;
  }

  /**
   * 12. Broadcast to Errand Ninja: New Errand Available (with dynamic Spintax to avoid ban filters)
   */
  static errandAvailableForNinja(data: { storeName: string; orderNumber: string; deliveryFee: number; variantIndex?: number }): string {
    const feeFormatted = (data.deliveryFee || 300).toLocaleString();
    const currentHourWAT = (new Date().getUTCHours() + 1) % 24;

    const greetings = [
      '⚡ *NEW ERRAND MISSION AVAILABLE!* 🛵',
      '🚨 *FRESH CAMPUS DROP READY!* 💸 🛵',
      '💰 *DELIVERY MISSION UNLOCKED!* ⚡ 🛵',
      '📦 *QUICK HOSTEL RUN AVAILABLE!* 🚀',
    ];

    let timeHook = 'A student on campus needs their order delivered right now!';
    let hypeKicker = 'Fatigue is temporary, cash in your wallet is forever! 💸';

    if (currentHourWAT >= 5 && currentHourWAT < 12) {
      timeHook = 'Start your morning stacking delivery fees early!';
      hypeKicker = 'Rise, grind, and secure your daily bag before noon! 🚀';
    } else if (currentHourWAT >= 12 && currentHourWAT < 17) {
      timeHook = 'Lunchtime rush is hot! Quick drop calling your name.';
      hypeKicker = 'Push through — another easy win in the wallet! 🏆';
    } else if (currentHourWAT >= 17 && currentHourWAT < 22) {
      timeHook = 'Dinner orders are flying in! Knock out this fast delivery.';
      hypeKicker = 'Finish strong and boost tonight’s total earnings! ✨';
    } else {
      timeHook = 'Late-night campus cravings! Fast pickup and clear roads.';
      hypeKicker = 'Night owl earnings for the dedicated Ninja on duty! 🌟';
    }

    const idx = (data.variantIndex !== undefined ? data.variantIndex : Math.floor(Math.random() * greetings.length)) % greetings.length;
    const header = greetings[idx];

    return `🤖 *Erranders Bot*

New errand · ₦${feeFormatted}
${data.storeName} · #${data.orderNumber}

Claim it: https://dispatch.erranders.org/orders`;
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
    return `🤖 *ERRANDERS BOT* · Mission Assignment Confirmed
━━━━━━━━━━━━━━━━━━━━━━
🛵 *YOU ARE ASSIGNED TO ORDER #${data.orderNumber}*

👋 Hi *${name}*, you have claimed order *#${data.orderNumber}*!

🏪 *Pickup Store:* ${data.storeName}
📍 *Deliver To:* ${data.deliveryAddress}
🛍️ *Items:* ${data.itemsCount || 1} item(s)
💰 *Your Earnings:* ₦${data.deliveryFee.toLocaleString()}

⚡ *Next Steps:*
1. Head to the store counter to collect the package.
2. Deliver directly to the customer's hostel/location.
3. Collect the customer's *4-digit Delivery PIN* to confirm delivery.

👉 *Manage order on your web app:*
https://dispatch.erranders.org/orders

━━━━━━━━━━━━━━━━━━━━━━
🤖 *Erranders Automated Bot System* · Campus Dispatch
🌐 https://erranders.org`;
  }

  /**
   * 14. Payout / Withdrawal Receipt for Vendors and Errand Ninjas
   */
  static payoutReceipt(data: PayoutReceiptTemplateData): string {
    const isNinja = data.role === 'rider' || data.role === 'errander';
    const roleTitle = isNinja ? '🛵 Errand Ninja Payout' : '🏪 Vendor Settlement';
    const recipientTitle = isNinja ? 'Errand Ninja' : 'Vendor Partner';
    const bank = data.bankName || 'Direct Bank Transfer';
    const maskedAcct = data.accountNumber
      ? (data.accountNumber.length > 4 ? `••••${data.accountNumber.slice(-4)}` : data.accountNumber)
      : 'Registered Account';
    const timeStr = (data.paidAt || new Date()).toLocaleString('en-NG', {
      timeZone: 'Africa/Lagos',
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const motivationalNote = isNinja
      ? 'Keep up the fantastic hustle! Great work completing campus runs. 🛵💨'
      : 'Thank you for serving the campus community with quality orders! 🌟';

    return `🤖 *ERRANDERS BOT* · Official Payment Receipt
━━━━━━━━━━━━━━━━━━━━━━
💸 *PAYOUT CONFIRMED & CREDITED!*

👋 Hi *${data.recipientName}* (${recipientTitle}),
Your withdrawal request has been approved and successfully credited to your bank account!

📋 *PAYOUT RECEIPT DETAILS*
━━━━━━━━━━━━━━━━━━━━━━
🧾 *Reference:* #${data.reference}
💰 *Amount Credited:* ₦${Number(data.amount).toLocaleString()}
🏦 *Bank:* ${bank}
💳 *Account:* ${maskedAcct}${data.accountName ? `\n👤 *Account Name:* ${data.accountName}` : ''}
📅 *Date & Time:* ${timeStr}
⚡ *Status:* ✅ *SUCCESSFUL / PAID*

💡 _${motivationalNote}_

━━━━━━━━━━━━━━━━━━━━━━
🤖 *Erranders Automated Bot System* · Treasury Desk
💬 For payout questions or support, reply directly to this chat.
🌐 https://erranders.org`;
  }
}
