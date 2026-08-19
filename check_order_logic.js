const { execSync } = require('child_process');
console.log("Checking Vendor Active Orders...");
console.log(execSync('grep -A 10 "getActiveOrders" src/modules/orders/orders.service.ts').toString());
console.log("Checking Dispatcher Available Orders...");
console.log(execSync('grep -A 10 "getAvailableOrders" src/modules/orders/orders.service.ts || echo "Not found"').toString());
