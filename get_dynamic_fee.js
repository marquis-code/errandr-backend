const fs = require('fs');
const content = fs.readFileSync('src/modules/orders/orders.service.ts', 'utf-8');
const lines = content.split('\n');
const start = lines.findIndex(l => l.includes('async calculateDynamicFee'));
console.log(lines.slice(start, start + 30).join('\n'));
