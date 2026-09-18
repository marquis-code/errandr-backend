const fs = require('fs');
const path = './src/modules/orders/schemas/order.schema.ts';
let code = fs.readFileSync(path, 'utf8');

if (!code.includes('cancellationPhotoProof: string;')) {
  code = code.replace(/export class Order extends Document \{/, "export class Order extends Document {\n  @Prop({ type: String })\n  cancellationPhotoProof: string;\n");
  fs.writeFileSync(path, code);
  console.log('Added cancellationPhotoProof to schema');
} else {
  console.log('cancellationPhotoProof already exists');
}
