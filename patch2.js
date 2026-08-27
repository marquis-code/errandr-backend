const fs = require('fs');
const file = 'src/modules/orders/orders.controller.ts';
let code = fs.readFileSync(file, 'utf8');
code = code.replace(/return this.ordersService.approveReconciliation\(id, \(user._id as unknown\) as string\);/, "return this.ordersService.approveReconciliation(id, user._id.toString());");
code = code.replace(/return this.ordersService.submitReconciliation\(id, \(user._id as unknown\) as string, body\);/, "return this.ordersService.submitReconciliation(id, user._id.toString(), body);");
fs.writeFileSync(file, code);
