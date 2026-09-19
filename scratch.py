import re

with open("src/modules/orders/orders.service.ts", "r") as f:
    code = f.read()

# We need to find `async resolveItemSubstitute` and see where we modify the item
