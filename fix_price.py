import re

with open("src/modules/orders/orders.service.ts", "r") as f:
    content = f.read()

# Fix requestItemSubstitute price
content = content.replace('price: (substituteObj as any).price,', 'price: (substituteObj as any).price || (substituteObj as any).pricePerPortion,')

# Fix resolveItemSubstitute price
content = content.replace('docItem.price = (substituteObj as any).price;', 'docItem.price = (substituteObj as any).price || (substituteObj as any).pricePerPortion;')
content = content.replace('docItem.subtotal = (substituteObj as any).price * quantity;', 'docItem.subtotal = ((substituteObj as any).price || (substituteObj as any).pricePerPortion) * quantity;')
content = content.replace('const newSubtotal = (substituteObj as any).price * quantity;', 'const newSubtotal = ((substituteObj as any).price || (substituteObj as any).pricePerPortion) * quantity;')

with open("src/modules/orders/orders.service.ts", "w") as f:
    f.write(content)
