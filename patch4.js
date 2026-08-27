const fs = require('fs');
const file = 'src/modules/orders/orders.service.ts';
let code = fs.readFileSync(file, 'utf8');

const replacement = `
    // If customer overpaid, refund the difference to their wallet
    if (order.refundAmount && order.refundAmount > 0) {
`;
const addition = `
    // If customer underpaid (over-budget), charge their wallet and reimburse errander
    if (order.shortfallAmount && order.shortfallAmount > 0) {
      try {
        await this.walletsService.forceDebitWallet(
          customerId.toString(),
          order.shortfallAmount,
          \`Deduction: Item cost reconciliation shortfall for order #\${order.orderNumber}\`
        );
        this.logger.log(\`Debited shortfall ₦\${order.shortfallAmount} from customer \${customerId} for order \${order.orderNumber}\`);

        // Credit Errander's wallet
        if (order.errander) {
          await this.walletsService.creditWallet(
            order.errander.toString(),
            order.shortfallAmount,
            \`Refund: Reimbursement for item cost shortfall for order #\${order.orderNumber}\`,
            order._id.toString(),
            order._id.toString() + '_shortfall'
          );
          this.logger.log(\`Reimbursed shortfall ₦\${order.shortfallAmount} to errander \${order.errander.toString()} for order \${order.orderNumber}\`);
        }
      } catch (e) {
        this.logger.error(\`Failed to process shortfall for order \${order.orderNumber}: \${e}\`);
        throw new BadRequestException('Failed to process payment for the shortfall amount. Please check your wallet balance.');
      }
    }

    // If customer overpaid, refund the difference to their wallet
    if (order.refundAmount && order.refundAmount > 0) {
`;

code = code.replace(replacement, addition);
fs.writeFileSync(file, code);
