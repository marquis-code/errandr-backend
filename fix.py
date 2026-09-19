with open("src/modules/orders/orders.service.ts", "r") as f:
    content = f.read()

content = content.replace("    const originalSubtotal = originalItemPrice * quantity;\n    const originalSubtotal = originalItemPrice * quantity;\n", "    const originalSubtotal = originalItemPrice * quantity;\n")

with open("src/modules/orders/orders.service.ts", "w") as f:
    f.write(content)
