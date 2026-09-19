import re

with open("src/modules/orders/orders.controller.ts", "r") as f:
    content = f.read()

search = r"""  @Post\(':id/items/:itemId/substitute/request'\)
  @UseGuards\(JwtAuthGuard\)
  @ApiBearerAuth\(\)
  @ApiOperation\(\{ summary: 'Rider requests to substitute an unavailable item \(legacy\)' \}\)
  requestItemSubstitute\(
    @Param\('id'\) id: string,
    @Param\('itemId'\) itemId: string,
    @Body\('substituteItemId'\) substituteItemId: string,
    @CurrentUser\(\) user: User
  \) \{
    this.logger.log\(`requestItemSubstitute\(\) id=\$\{id\} itemId=\$\{itemId\} substitute=\$\{substituteItemId\} user=\$\{user._id\}`\);
    return this.ordersService.requestItemSubstitute\(id, itemId, substituteItemId, user._id.toString\(\)\);
  \}"""

replace = """  @Post(':id/items/:itemId/substitute/request')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rider requests to substitute an unavailable item (legacy)' })
  requestItemSubstitute(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: { substituteItemId?: string; substituteItemIds?: string[]; itemName?: string },
    @CurrentUser() user: User
  ) {
    this.logger.log(`requestItemSubstitute() id=${id} itemId=${itemId} substitute=${body.substituteItemId} substituteItemIds=${body.substituteItemIds?.join(',')} user=${user._id}`);
    return this.ordersService.requestItemSubstitute(id, itemId, body.substituteItemId || '', user._id.toString(), body.itemName, body.substituteItemIds);
  }"""

new_content = re.sub(search, replace, content)

with open("src/modules/orders/orders.controller.ts", "w") as f:
    f.write(new_content)
