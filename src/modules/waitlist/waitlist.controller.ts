import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/decorators';
import { WaitlistService } from './waitlist.service';

@ApiTags('Waitlist')
@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly service: WaitlistService) {}

  // ─── Public: a customer filling a vendor's form. No auth by design. ───
  @Get('public/:subdomain/:slug')
  @ApiOperation({ summary: 'Published waitlist form for a store' })
  publicForm(@Param('subdomain') subdomain: string, @Param('slug') slug: string) {
    return this.service.publicForm(subdomain, slug);
  }

  @Post('public/:subdomain/:slug')
  @ApiOperation({ summary: 'Submit a waitlist response' })
  submit(@Param('subdomain') subdomain: string, @Param('slug') slug: string, @Body() body: { answers: Record<string, any> }) {
    return this.service.submit(subdomain, slug, body?.answers || {});
  }

  // ─── Vendor: create and manage ───
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a waitlist form' })
  create(@Req() req: any, @Body() body: any) {
    return this.service.create(req.user._id.toString(), body);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "This store's waitlist forms" })
  list(@Req() req: any) {
    return this.service.list(req.user._id.toString());
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update or publish a form' })
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.update(req.user._id.toString(), id, body);
  }

  @Get(':id/responses')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Responses to a form' })
  responses(@Req() req: any, @Param('id') id: string) {
    return this.service.responses(req.user._id.toString(), id);
  }
}
