const fs = require('fs');
const path = './src/modules/orders/orders.service.ts';
let code = fs.readFileSync(path, 'utf8');

const regex = /if \(item\.price !== \(\(substituteObj as any\)\.price \|\| \(substituteObj as any\)\.pricePerPortion\)\)/;

const newLogic = `
        const errandSetting = await this.settingModel.findOne({ key: 'custom_errand' }).exec();
        const markupPct = errandSetting?.value?.foodMarkupPercentage ?? 5;
        const factor = 1 + (markupPct / 100);
        
        let substitutePrice = (substituteObj as any).price;
        if (substitutePrice === undefined && (substituteObj as any).pricePerPortion !== undefined) {
          substitutePrice = Math.ceil((substituteObj as any).pricePerPortion * factor);
        }
        
        if (item.price !== substitutePrice)
`;

code = code.replace(regex, newLogic);
fs.writeFileSync(path, code);
console.log('Fixed backend price logic fully');
