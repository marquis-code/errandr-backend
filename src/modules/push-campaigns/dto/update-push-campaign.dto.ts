import { PartialType } from '@nestjs/swagger';
import { CreatePushCampaignDto } from './create-push-campaign.dto';

export class UpdatePushCampaignDto extends PartialType(CreatePushCampaignDto) {}
