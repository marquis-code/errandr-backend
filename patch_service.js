const fs = require('fs');
const file = 'src/modules/orders/orders.service.ts';
let content = fs.readFileSync(file, 'utf8');

// Replace exact match to handle both
const outsideCheck = "data.locationType === LocationType.OUTSIDE_CAMPUS";
const bothCheck = "(data.locationType === LocationType.OUTSIDE_CAMPUS || data.locationType === LocationType.CAMPUS_ENVIRONS)";

// We need to replace it everywhere
content = content.split(outsideCheck).join(bothCheck);

// Let's also check for order.locationType === LocationType.OUTSIDE_CAMPUS
const orderOutsideCheck = "order.locationType === LocationType.OUTSIDE_CAMPUS";
const orderBothCheck = "(order.locationType === LocationType.OUTSIDE_CAMPUS || order.locationType === LocationType.CAMPUS_ENVIRONS)";
content = content.split(orderOutsideCheck).join(orderBothCheck);

fs.writeFileSync(file, content, 'utf8');
