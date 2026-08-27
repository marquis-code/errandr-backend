const fs = require('fs');
const file = 'src/modules/orders/orders.service.ts';
let code = fs.readFileSync(file, 'utf8');

// Update submitReconciliation
code = code.replace(
  /order\.refundAmount = difference > 0 \? difference : 0;/g,
  "order.refundAmount = difference > 0 ? difference : 0;\n    order.shortfallAmount = difference < 0 ? Math.abs(difference) : 0;"
);

// Update submitReconciliation message
code = code.replace(
  /const message = difference > 0[\s\S]*?difference\.toLocaleString\(\)\}\`\n[\s\S]*?:\s*`Your rider submitted the actual cost.*?\`;/,
  `const message = difference > 0\n        ? \`Your rider submitted the actual cost of ₦\${data.actualItemCost.toLocaleString()} for order #\${order.orderNumber}. Since you paid a total of ₦\${totalHeldByRider.toLocaleString()} (Estimate + Buffer), you will receive a refund of ₦\${difference.toLocaleString()} once approved.\`\n        : difference < 0\n        ? \`Your rider submitted the actual cost of ₦\${data.actualItemCost.toLocaleString()} for order #\${order.orderNumber}. Since you only paid ₦\${totalHeldByRider.toLocaleString()}, there is a shortfall of ₦\${Math.abs(difference).toLocaleString()} which must be approved and paid.\`\n        : \`Your rider submitted the actual cost of ₦\${data.actualItemCost.toLocaleString()} for order #\${order.orderNumber}, which matches exactly what was paid. Please approve the reconciliation.\`;`
);

fs.writeFileSync(file, code);
