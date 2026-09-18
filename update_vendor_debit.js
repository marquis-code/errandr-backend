const fs = require('fs');
const path = './src/modules/orders/orders.service.ts';
let code = fs.readFileSync(path, 'utf8');

const regex = /if \(refundedAmount > 0\) \{/;

const newLogic = `
    if (refundedAmount > 0) {
      // 1. Debit the vendor if they've already been paid
      if (order.paymentStatus === 'paid' && order.vendor) {
        const fullOrder = await this.orderModel.findById(orderId).populate('vendor');
        if (fullOrder && fullOrder.vendor) {
          const ownerId = (fullOrder.vendor as any).owner;
          if (ownerId) {
            const markupPct = fullOrder.foodMarkupPercentage || 5;
            const vendorRefundShare = Math.round(refundedAmount / (1 + (markupPct / 100)));
            
            // Debit the vendor's wallet
            await this.walletsService.debitWallet(
              ownerId.toString(),
              vendorRefundShare,
              \`Reversal for unavailable item in Order #\${order.orderNumber}\`,
              order._id.toString()
            ).catch(e => this.logger.error(\`Failed to debit vendor \${ownerId} for \${vendorRefundShare}\`, e));
            
            // Deduct from order vendor share
            order.vendorShare = Math.max(0, (order.vendorShare || 0) - vendorRefundShare);
            
            // Deduct from platform share
            order.platformShare = Math.max(0, (order.platformShare || 0) - (refundedAmount - vendorRefundShare));
          }
        }
      }

      // 2. Refund the student
`;

if (regex.test(code)) {
  code = code.replace(regex, newLogic.trim());
  fs.writeFileSync(path, code);
  console.log('Successfully added vendor debit logic');
} else {
  console.log('Could not find refundedAmount > 0 block');
}
