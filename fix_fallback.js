const fs = require('fs');
const pathService = './src/modules/orders/orders.service.ts';
const pathController = './src/modules/orders/orders.controller.ts';

// 1. Update Controller
let ctrlCode = fs.readFileSync(pathController, 'utf8');
ctrlCode = ctrlCode.replace(
    /(@Body\(\) body: { substituteItemId: string })/,
    `@Body() body: { substituteItemId: string; originalItemName?: string }`
);
ctrlCode = ctrlCode.replace(
    /this\.ordersService\.requestItemSubstitute\(id, itemId, body\.substituteItemId, user\._id\.toString\(\)\)/,
    `this.ordersService.requestItemSubstitute(id, itemId, body.substituteItemId, user._id.toString(), body.originalItemName)`
);
fs.writeFileSync(pathController, ctrlCode);

// 2. Update Service
let srvCode = fs.readFileSync(pathService, 'utf8');
srvCode = srvCode.replace(
    /async requestItemSubstitute\(orderId: string, itemId: string, substituteItemId: string, userId: string\) {/,
    `async requestItemSubstitute(orderId: string, itemId: string, substituteItemId: string, userId: string, providedOriginalItemName?: string) {`
);

const fallbackLogic = `
    // BULLETPROOF FALLBACK: Match by name if provided
    if (!itemFound && providedOriginalItemName) {
      this.logger.log(\`[SUBSTITUTE DEBUG] ID matching failed. Falling back to name matching for \${providedOriginalItemName}\`);
      
      const searchItems = (items) => {
        if (!items) return false;
        for (const item of items) {
          if (item.name?.toLowerCase() === providedOriginalItemName.toLowerCase()) {
            if (item.price !== (substituteObj as any).price) throw new BadRequestException('Substitute must be the exact same price');
            originalItemName = item.name;
            itemFound = true;
            return true;
          }
        }
        return false;
      };

      if (!searchItems(order.menuItems)) {
        if (!searchItems(order.items)) {
          if (order.packs) {
            for (const pack of order.packs) {
              if (searchItems(pack.items)) break;
            }
          }
        }
      }
    }

    if (!itemFound) throw new NotFoundException('Original item not found in order');`;

srvCode = srvCode.replace(
    /if \(!itemFound\) throw new NotFoundException\('Original item not found in order'\);/g,
    (match) => fallbackLogic
);

// We applied it globally, but we only want it in requestItemSubstitute, not resolveItemSubstitute.
// Actually, resolveItemSubstitute doesn't have providedOriginalItemName, so it won't trigger. 
// But wait, providedOriginalItemName is only in requestItemSubstitute scope!
// The replace above will cause a ReferenceError in resolveItemSubstitute. Let's fix that.
