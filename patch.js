const fs = require('fs');
const file = 'src/modules/orders/schemas/order.schema.ts';
let code = fs.readFileSync(file, 'utf8');
code = code.replace(/@Prop\(\{ default: 0 \}\)\n  refundAmount: number;/, "@Prop({ default: 0 })\n  refundAmount: number;\n\n  @Prop({ default: 0 })\n  shortfallAmount: number;");
fs.writeFileSync(file, code);
