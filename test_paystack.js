const { execSync } = require('child_process');
console.log("Looking for Paystack Webhook...");
console.log(execSync('grep -R "paystack" src/modules | grep webhook || echo "No webhook found"').toString());
