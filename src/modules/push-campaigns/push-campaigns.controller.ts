import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PushCampaignsService } from './push-campaigns.service';
import { CreatePushCampaignDto } from './dto/create-push-campaign.dto';
import { UpdatePushCampaignDto } from './dto/update-push-campaign.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('push-campaigns')
@Controller('push-campaigns')
export class PushCampaignsController {
  constructor(private readonly pushCampaignsService: PushCampaignsService) {}

  @Post()
  create(@Body() createPushCampaignDto: CreatePushCampaignDto) {
    return this.pushCampaignsService.create(createPushCampaignDto);
  }

  @Get()
  findAll() {
    return this.pushCampaignsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pushCampaignsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePushCampaignDto: UpdatePushCampaignDto) {
    return this.pushCampaignsService.update(id, updatePushCampaignDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.pushCampaignsService.remove(id);
  }

  @Post(':id/trigger')
  trigger(@Param('id') id: string) {
    return this.pushCampaignsService.triggerCampaign(id);
  }
}
