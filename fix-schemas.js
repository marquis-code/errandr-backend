const fs = require('fs');
const path = require('path');

const schemasDir = path.join(__dirname, 'src/modules/market-pool/schemas');
const files = fs.readdirSync(schemasDir).filter(f => f.endsWith('.schema.ts'));

for (const file of files) {
  const filePath = path.join(schemasDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (!content.includes("import * as mongoose")) {
    content = content.replace("import { Document, Types } from 'mongoose';", "import * as mongoose from 'mongoose';\nimport { Document, Types } from 'mongoose';");
  }
  
  content = content.replace(/type: Types\.ObjectId/g, "type: mongoose.Schema.Types.ObjectId");
  
  fs.writeFileSync(filePath, content);
}
console.log('Schemas fixed');
