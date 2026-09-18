const fs = require('fs');
const path = './src/modules/orders/schemas/order.schema.ts';
let code = fs.readFileSync(path, 'utf8');

if (!code.includes('pendingTopupAmount: number;')) {
  code = code.replace(/export class Order \{/, "export class Order {\n  @Prop({ type: Number, default: 0 })\n  pendingTopupAmount: number;\n");
  fs.writeFileSync(path, code);
  console.log('Added pendingTopupAmount to schema');
} else {
  console.log('pendingTopupAmount already exists');
}
