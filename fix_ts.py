import re

with open("src/modules/orders/orders.service.ts", "r") as f:
    content = f.read()

# Add HttpException import if missing
if 'HttpException' not in content:
    content = content.replace("NotFoundException,", "NotFoundException, HttpException,")
    # or just find "import { " and add it if we can't find exact match, but let's just do:
    content = re.sub(r'import \{ (.*?) \} from \'@nestjs/common\';', r'import { \1, HttpException } from \'@nestjs/common\';', content, count=1)

# Fix substituteOptions type
content = content.replace('const substituteOptions = [];', 'const substituteOptions: any[] = [];')

# Fix substituteObj.price casting
content = content.replace('price: substituteObj.price', 'price: (substituteObj as any).price')
content = content.replace('docItem.price = substituteObj.price', 'docItem.price = (substituteObj as any).price')
content = content.replace('docItem.subtotal = substituteObj.price * quantity', 'docItem.subtotal = (substituteObj as any).price * quantity')
content = content.replace('const newSubtotal = substituteObj.price * quantity', 'const newSubtotal = (substituteObj as any).price * quantity')

with open("src/modules/orders/orders.service.ts", "w") as f:
    f.write(content)

