const fs = require('fs');

// 1. Controller
const cPath = './src/modules/orders/orders.controller.ts';
let cCode = fs.readFileSync(cPath, 'utf8');

cCode = cCode.replace(
  /@Body\(\) body: \{ reason: string \}/,
  "@Body() body: { reason: string; photoProof: string }"
);
cCode = cCode.replace(
  /this\.ordersService\.cancelCustomErrand\(id, user\._id\.toString\(\), body\.reason\)/,
  "this.ordersService.cancelCustomErrand(id, user._id.toString(), body.reason, body.photoProof)"
);
fs.writeFileSync(cPath, cCode);
console.log('Updated controller');

// 2. Service
const sPath = './src/modules/orders/orders.service.ts';
let sCode = fs.readFileSync(sPath, 'utf8');

// The function signature
sCode = sCode.replace(
  /async cancelCustomErrand\(orderId: string, erranderId: string, reason: string\): Promise<Order> \{/,
  "async cancelCustomErrand(orderId: string, erranderId: string, reason: string, photoProof: string): Promise<Order> {"
);

// The logic inside
const refundLogicOriginal = `
    // Refund Customer (Total Amount - platform processing fee, maybe refund processing fee too?)
    const refundAmount = order.total;
    const customerId = (order.customer?._id || order.customer)?.toString();
    
    await this.walletsService.creditWallet(
      customerId,
      refundAmount,
      \`Refund: Custom errand #\${order.orderNumber} cancelled by Errander (\${reason})\`,
      order._id.toString()
    );
`;

const refundLogicNew = `
    if (!photoProof) throw new BadRequestException('Photo proof is required to cancel a custom errand');

    const customerId = (order.customer?._id || order.customer)?.toString();
    const deliveryFee = order.deliveryFee || 0;
    const refundAmount = (order.total || 0) - deliveryFee;

    // Refund Customer (Total Amount minus delivery fee)
    if (refundAmount > 0) {
      await this.walletsService.creditWallet(
        customerId,
        refundAmount,
        \`Refund: Custom errand #\${order.orderNumber} cancelled (Item Unavailable). Delivery fee retained.\`,
        order._id.toString()
      );
    }

    // Payout Errander (Delivery Fee)
    if (deliveryFee > 0) {
      await this.walletsService.creditWallet(
        erranderId,
        deliveryFee,
        \`Payout: Base fare for cancelled custom errand #\${order.orderNumber}\`,
        order._id.toString()
      );
    }
    
    order.cancellationPhotoProof = photoProof;
`;

if (sCode.includes('const refundAmount = order.total;')) {
  sCode = sCode.replace(refundLogicOriginal, refundLogicNew);
  fs.writeFileSync(sPath, sCode);
  console.log('Updated service');
} else {
  console.log('Could not find refund logic in service');
}
