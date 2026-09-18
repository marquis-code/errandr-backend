const fs = require('fs');
const path = './src/modules/orders/orders.service.ts';
let code = fs.readFileSync(path, 'utf8');

const regex = /if \(\(substituteObj as any\)\.vendor\?\.toString\(\) !== order\.vendor\?\.toString\(\)\)/g;
const newLogic = `const subVendorId = (substituteObj as any).vendorId || (substituteObj as any).vendor;
    if (subVendorId?.toString() !== order.vendor?.toString())`;

code = code.replace(regex, newLogic);
fs.writeFileSync(path, code);
console.log('Fixed backend vendor check');
