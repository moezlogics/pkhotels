import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { BillingService } from './billing.service';

const actor = (req: any) => ({ userId: req.user?.userId, role: req.user?.role });

/** Boosts and commission invoices. Owners see their hotel's; admins see everything. */
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  /* ── hotel owner ── */

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  mine(@Request() req, @Query('hotelId') hotelId?: string) {
    return this.billing.overview(actor(req), hotelId);
  }

  @Post('boosts/:planId/buy')
  @UseGuards(JwtAuthGuard)
  @Throttle({ medium: { limit: 10, ttl: 60_000 } })
  buy(@Request() req, @Param('planId') planId: string, @Query('hotelId') hotelId?: string) {
    return this.billing.buyBoost(actor(req), planId, hotelId);
  }

  @Get('invoices/:id')
  @UseGuards(JwtAuthGuard)
  invoice(@Request() req, @Param('id') id: string) {
    return this.billing.invoiceFor(actor(req), id);
  }

  @Post('invoices/:id/payment')
  @UseGuards(JwtAuthGuard)
  @Throttle({ medium: { limit: 10, ttl: 60_000 } })
  pay(@Request() req, @Param('id') id: string, @Body() dto: any) {
    return this.billing.submitProof(actor(req), id, dto ?? {});
  }

  /* ── admin ── */

  @Get('admin/summary')
  @UseGuards(JwtAuthGuard, AdminGuard)
  summary() {
    return this.billing.summary();
  }

  @Get('admin/invoices')
  @UseGuards(JwtAuthGuard, AdminGuard)
  list(@Query() q: Record<string, any>) {
    return this.billing.list({ status: q.status, kind: q.kind, q: q.q, page: Number(q.page) || 1 });
  }

  @Get('admin/follow-ups')
  @UseGuards(JwtAuthGuard, AdminGuard)
  followUps() {
    return this.billing.followUps();
  }

  @Post('admin/invoices/:id/approve')
  @UseGuards(JwtAuthGuard, AdminGuard)
  approve(@Request() req, @Param('id') id: string) {
    return this.billing.approve(id, req.user.userId);
  }

  @Post('admin/invoices/:id/reject')
  @UseGuards(JwtAuthGuard, AdminGuard)
  reject(@Request() req, @Param('id') id: string, @Body('reason') reason: string) {
    return this.billing.reject(id, reason, req.user.userId);
  }

  @Post('admin/invoices/:id/void')
  @UseGuards(JwtAuthGuard, AdminGuard)
  void(@Param('id') id: string, @Body('note') note: string) {
    return this.billing.void(id, note);
  }

  @Patch('admin/invoices/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  followUp(@Param('id') id: string, @Body() dto: any) {
    return this.billing.followUp(id, dto ?? {});
  }

  @Post('admin/generate')
  @UseGuards(JwtAuthGuard, AdminGuard)
  generate(@Body('period') period: string) {
    return this.billing.generate(String(period || ''), 'admin');
  }

  @Get('admin/boosts')
  @UseGuards(JwtAuthGuard, AdminGuard)
  boosts() {
    return this.billing.listBoostPlans();
  }

  @Post('admin/boosts')
  @UseGuards(JwtAuthGuard, AdminGuard)
  addBoost(@Body() dto: any) {
    return this.billing.saveBoostPlan(null, dto ?? {});
  }

  @Put('admin/boosts/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  saveBoost(@Param('id') id: string, @Body() dto: any) {
    return this.billing.saveBoostPlan(id, dto ?? {});
  }

  @Delete('admin/boosts/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  deleteBoost(@Param('id') id: string) {
    return this.billing.deleteBoostPlan(id);
  }

  @Post('admin/disputes/:bookingId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  dispute(@Request() req, @Param('bookingId') bookingId: string, @Body('decision') decision: string) {
    return this.billing.decideDispute(bookingId, decision, req.user.userId);
  }
}
