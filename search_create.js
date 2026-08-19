const fs = require('fs');
const content = fs.readFileSync('src/modules/orders/orders.service.ts', 'utf-8');

function extractMethod(methodName) {
  const lines = content.split('\n');
  const start = lines.findIndex(l => l.includes(methodName + '(') && !l.includes('this.'));
  if (start === -1) return "Not found";
  
  let brackets = 0;
  let end = start;
  for (let i = start; i < lines.length; i++) {
    if (lines[i].includes('{')) brackets += (lines[i].match(/{/g) || []).length;
    if (lines[i].includes('}')) brackets -= (lines[i].match(/}/g) || []).length;
    if (brackets === 0 && i > start) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end + 1).join('\n');
}

console.log(extractMethod('async create'));
