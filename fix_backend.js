const fs = require('fs');
const path = './src/modules/orders/orders.service.ts';
let code = fs.readFileSync(path, 'utf8');

// The original line:
// if (item.price !== (substituteObj as any).price) throw new BadRequestException('Substitute must be the exact same price');

code = code.replace(
  /if \(item\.price !== \(substituteObj as any\)\.price\)/,
  "if (item.price !== ((substituteObj as any).price || (substituteObj as any).pricePerPortion))"
);

fs.writeFileSync(path, code);
console.log('Fixed backend price check');
