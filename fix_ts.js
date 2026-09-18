const fs = require('fs');
const path = './src/modules/orders/orders.service.ts';
let code = fs.readFileSync(path, 'utf8');

// Fix 1: sendPushNotification to sendNotification
code = code.replace(/this\.notificationsService\.sendPushNotification\([^]+?\}\s*\)\.catch\(\(\) => \{\}\);/g, (match) => {
  return match.replace(/sendPushNotification\(\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^)]+)\s*\)/, 'sendNotification($1, { title: $2, body: $3, payload: $4 })');
});

// Fix 2: sendNotificationToUser to sendToUser
code = code.replace(/this\.notificationsGateway\.sendNotificationToUser/g, 'this.notificationsGateway.sendToUser');

// Fix 3: any cast for vendor and price
code = code.replace(/if \(substituteObj\.vendor\?/g, 'if ((substituteObj as any).vendor?');
code = code.replace(/substituteObj\.price/g, '(substituteObj as any).price');

// Also fix the payload of sendToUser which expected { type, title, message, payload } but sendToUser expects { title, body, type, data }
code = code.replace(/sendToUser\([^]+?\}\);/g, (match) => {
  let newMatch = match.replace('message:', 'body:').replace('payload:', 'data:');
  return newMatch;
});

fs.writeFileSync(path, code);
