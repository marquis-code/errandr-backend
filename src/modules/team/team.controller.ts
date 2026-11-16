import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TeamService } from './team.service';
import { TeamRole, TeamStatus } from './schemas/team-member.schema';

@ApiTags('team')
@Controller('team')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  /** The strategy returns the user document, so the id is `_id`; older guards used `userId`. */
  private uid(req: any): string {
    return String(req.user?.userId ?? req.user?._id ?? '');
  }

  @Post('invite')
  @ApiOperation({ summary: 'Add someone to your service team' })
  invite(
    @Req() req: any,
    @Body() body: { name: string; email: string; phone?: string; role?: TeamRole; payoutSharePercent?: number },
  ) {
    return this.teamService.invite(this.uid(req), body);
  }

  @Get()
  @ApiOperation({ summary: 'Everyone on your team, with jobs completed' })
  list(@Req() req: any) {
    return this.teamService.list(this.uid(req));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Change a team member role, share or status' })
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { name?: string; phone?: string; role?: TeamRole; payoutSharePercent?: number; status?: TeamStatus },
  ) {
    return this.teamService.update(this.uid(req), id, body);
  }

  @Post(':id/remind-bank')
  @ApiOperation({ summary: 'Ask a team member to add their payout account' })
  remindBank(@Req() req: any, @Param('id') id: string) {
    return this.teamService.remindToAddBank(this.uid(req), id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Take someone off your team' })
  remove(@Req() req: any, @Param('id') id: string) {
    return this.teamService.remove(this.uid(req), id);
  }

  @Get('me')
  @ApiOperation({ summary: 'Your memberships and the jobs assigned to you' })
  mine(@Req() req: any) {
    return this.teamService.mine(this.uid(req));
  }

  @Post('accept')
  @ApiOperation({ summary: 'Accept an invite with the code from the shop' })
  accept(@Req() req: any, @Body() body: { code: string }) {
    return this.teamService.accept(this.uid(req), body.code);
  }
}
