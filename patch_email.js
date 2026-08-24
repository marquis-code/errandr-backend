const fs = require('fs');
const file = 'src/modules/email/email.service.ts';
let content = fs.readFileSync(file, 'utf8');

const oldMethod = `  async sendOrderConfirmation(to: string, order: any) {
    const itemsHtml = order.items?.map((item: any) => \`
      <tr>
        <td class="label" style="font-weight: 500; color: #3f3f46;">\${item.name} <span style="color:#a1a1aa">× \${item.quantity}</span></td>
        <td class="value">₦\${(item.price * item.quantity).toLocaleString()}</td>
      </tr>
    \`).join('') || '';

    const html = this.wrap({
      preheader: \`Order #\${order.orderNumber} confirmed!\`,
      badge: { text: 'ORDER CONFIRMED', color: 'orange' },
      title: 'Your order is being prepared!',
      subtitle: \`Order <b>#\${order.orderNumber}</b> is confirmed and the vendor is preparing it now.\`,
      content: \`
        <div class="card" style="text-align: left;">
          <p class="card-label" style="margin-bottom: 12px;">Order Summary</p>
          <table class="data-table">
            \${itemsHtml}
            <tr>
              <td style="padding: 16px 0 0; font-size: 14px; font-weight: 600; color: #27272a; border-top: 1px solid #e4e4e7; margin-top: 8px;">Total</td>
              <td style="padding: 16px 0 0; font-size: 16px; font-weight: 700; color: #FF5C1A; text-align: right; border-top: 1px solid #e4e4e7; margin-top: 8px;">₦\${order.total?.toLocaleString()}</td>
            </tr>
          </table>
        </div>

        <div style="text-align: center;">
          <a href="https://www.erranders.org/dashboard/orders/\${order._id}" class="btn">Track Order</a>
        </div>
      \`
    });
    return this.sendEmail(to, \`🚀 Order Confirmed: #\${order.orderNumber}\`, html);
  }`;

const newMethod = `  async sendOrderConfirmation(to: string, order: any) {
    const itemsHtml = order.items?.map((item: any) => \`
      <tr>
        <td class="label" style="font-weight: 500; color: #3f3f46;">\${item.name} <span style="color:#a1a1aa">× \${item.quantity}</span></td>
        <td class="value">₦\${(item.price * item.quantity).toLocaleString()}</td>
      </tr>
    \`).join('') || '';

    const customerName = (order.customer && order.customer.firstName) ? order.customer.firstName : 'Student';
    const securityPin = order.securityPin || 'N/A';

    const html = this.wrap({
      preheader: \`Payment confirmed for Order #\${order.orderNumber}!\`,
      badge: { text: 'PAYMENT CONFIRMED', color: 'green' },
      title: \`Thank you for your order, \${customerName}!\`,
      subtitle: \`We've received your payment for order <b>#\${order.orderNumber}</b>. The vendor is preparing it right now!\`,
      content: \`
        <div class="card" style="background: #FFF4F0; text-align: center; border-color: #ffedd5; margin-bottom: 24px;">
          <p class="card-label" style="color: #EA580C; margin-bottom: 8px;">Your Delivery Security PIN</p>
          <p style="font-size: 32px; font-weight: 800; color: #FF5C1A; letter-spacing: 4px; margin: 0;">\${securityPin}</p>
          <p style="font-size: 13px; color: #9a3412; margin: 12px 0 0;">Please provide this PIN to your Errander upon delivery. Keep it safe!</p>
        </div>

        <div class="card" style="text-align: left;">
          <p class="card-label" style="margin-bottom: 12px;">Order Details</p>
          <table class="data-table">
            \${itemsHtml}
            <tr>
              <td style="padding: 16px 0 0; font-size: 14px; font-weight: 600; color: #27272a; border-top: 1px solid #e4e4e7; margin-top: 8px;">Total Paid</td>
              <td style="padding: 16px 0 0; font-size: 16px; font-weight: 700; color: #10B981; text-align: right; border-top: 1px solid #e4e4e7; margin-top: 8px;">₦\${order.total?.toLocaleString()}</td>
            </tr>
          </table>
        </div>

        <div style="text-align: center;">
          <a href="https://www.erranders.org/dashboard/orders/\${order._id}" class="btn">Track Order Progress</a>
        </div>
      \`
    });
    return this.sendEmail(to, \`🚀 Payment Confirmed: Order #\${order.orderNumber}\`, html);
  }`;

content = content.replace(oldMethod, newMethod);
fs.writeFileSync(file, content, 'utf8');
