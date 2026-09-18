const fs = require('fs');
const path = './src/modules/orders/orders.service.ts';
let code = fs.readFileSync(path, 'utf8');

const regex = /if \(!itemFound\) throw new NotFoundException\('Original item not found in order'\);/g;
let matchCount = 0;
code = code.replace(regex, (match) => {
    matchCount++;
    if (matchCount === 2) {
        // This is inside resolveItemSubstitute
        return `    if (!itemFound && order.packs) {
      for (const pack of order.packs) {
        for (const item of pack.items) {
          const subDocId = (item as any)._id?.toString();
          const productRef = item.product?.toString();
          if (subDocId === itemId || productRef === itemId) {
            if (item.status === 'unavailable' || item.status === 'substituted') {
              throw new BadRequestException('Item already handled');
            }
            item.status = 'substituted';
            item.substitutedWith = {
              product: substituteObj._id,
              name: substituteObj.name
            };
            item.name = \`\${substituteObj.name} (Substituted for \${item.name})\`;
            itemFound = true;
            break;
          }
        }
        if (itemFound) break;
      }
    }

    if (!itemFound) throw new NotFoundException('Original item not found in order');`;
    }
    return match;
});

fs.writeFileSync(path, code);
console.log('Fixed resolveItemSubstitute packs check');
