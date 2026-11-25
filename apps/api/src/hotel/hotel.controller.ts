import { Body, Controller, Delete, Get, Header, HttpCode, Param, Patch, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { HotelService } from './hotel.service';

const actor = (req: any) => ({ userId: req.user?.userId, role: req.user?.role });

@Controller('hotels')
export class HotelController {
  constructor(private readonly hotels: HotelService) {}

  /* ── public ── */

  @Get()
  search(@Query() q: Record<string, any>) {
    return this.hotels.search(q);
  }

  @Get('featured')
  featured(@Query('limit') limit?: string, @Query('city') city?: string) {
    return this.hotels.featured(Math.min(24, Number(limit) || 8), city);
  }

  @Get('cities')
  cities() {
    return this.hotels.cityStats();
  }

  @Get('city/:slug')
  city(@Param('slug') slug: string) {
    return this.hotels.cityInfo(slug);
  }

  @Get('slugs')
  slugs() {
    return this.hotels.slugs();
  }

  @Get('room-redirect/:wpSlug')
  roomRedirect(@Param('wpSlug') wpSlug: string) {
    return this.hotels.roomRedirect(wpSlug);
  }

  @Get('slug/:slug')
  bySlug(@Param('slug') slug: string) {
    return this.hotels.bySlug(slug);
  }

  @Get('slug/:slug/quote')
  quote(@Param('slug') slug: string, @Query('checkIn') checkIn: string, @Query('checkOut') checkOut: string) {
    return this.hotels.quoteBySlug(slug, checkIn, checkOut);
  }

  @Get('slug/:slug/similar')
  similar(@Param('slug') slug: string) {
    return this.hotels.similar(slug);
  }

  @Get(':id/reviews')
  reviews(@Param('id') id: string, @Query('page') page?: string) {
    return this.hotels.listReviews(id, Math.max(1, Number(page) || 1));
  }

  /** The signed-in account's own review of this hotel (any account may write one). */
  @Get(':id/reviews/mine')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store')
  myReview(@Param('id') id: string, @Request() req) {
    return this.hotels.myReview(id, req.user.userId);
  }

  @Put(':id/reviews/mine')
  @UseGuards(JwtAuthGuard)
  @Throttle({ medium: { limit: 6, ttl: 60_000 }, long: { limit: 20, ttl: 3_600_000 } })
  saveReview(@Param('id') id: string, @Request() req, @Body() dto: any) {
    return this.hotels.saveMyReview(id, req.user.userId, dto ?? {});
  }

  @Delete(':id/reviews/mine')
  @UseGuards(JwtAuthGuard)
  deleteReview(@Param('id') id: string, @Request() req) {
    return this.hotels.deleteMyReview(id, req.user.userId);
  }

  @Post(':id/view')
  @HttpCode(200)
  @Throttle({ short: { limit: 5, ttl: 1000 } })
  view(@Param('id') id: string) {
    return this.hotels.trackView(id);
  }

  /* ── the signed-in owner's hotel (admins pass ?hotelId= to manage any) ── */

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  mine(@Request() req, @Query('hotelId') hotelId?: string) {
    return this.hotels.mine(actor(req), hotelId);
  }

  @Post('mine')
  @UseGuards(JwtAuthGuard)
  create(@Request() req, @Body() dto: any) {
    return this.hotels.create(actor(req), dto);
  }

  @Put('mine')
  @UseGuards(JwtAuthGuard)
  update(@Request() req, @Body() dto: any, @Query('hotelId') hotelId?: string) {
    return this.hotels.update(actor(req), dto, hotelId);
  }

  @Post('mine/submit')
  @UseGuards(JwtAuthGuard)
  submit(@Request() req, @Query('hotelId') hotelId?: string) {
    return this.hotels.submit(actor(req), hotelId);
  }

  @Post('mine/rooms')
  @UseGuards(JwtAuthGuard)
  addRoom(@Request() req, @Body() dto: any, @Query('hotelId') hotelId?: string) {
    return this.hotels.addRoom(actor(req), dto, hotelId);
  }

  @Put('mine/rooms/:roomId')
  @UseGuards(JwtAuthGuard)
  updateRoom(@Request() req, @Param('roomId') roomId: string, @Body() dto: any, @Query('hotelId') hotelId?: string) {
    return this.hotels.updateRoom(actor(req), roomId, dto, hotelId);
  }

  @Delete('mine/rooms/:roomId')
  @UseGuards(JwtAuthGuard)
  deleteRoom(@Request() req, @Param('roomId') roomId: string, @Query('hotelId') hotelId?: string) {
    return this.hotels.deleteRoom(actor(req), roomId, hotelId);
  }

  @Get('mine/calendar')
  @UseGuards(JwtAuthGuard)
  calendar(@Request() req, @Query('from') from: string, @Query('days') days: string, @Query('hotelId') hotelId?: string) {
    return this.hotels.calendar(actor(req), from, Number(days) || 31, hotelId);
  }

  @Put('mine/calendar')
  @UseGuards(JwtAuthGuard)
  setRates(@Request() req, @Body() dto: any, @Query('hotelId') hotelId?: string) {
    return this.hotels.setRates(actor(req), dto, hotelId);
  }

  @Post(':id/claim')
  @UseGuards(JwtAuthGuard)
  @Throttle({ medium: { limit: 5, ttl: 60_000 } })
  claim(@Request() req, @Param('id') id: string, @Body() dto: any) {
    return this.hotels.claim(actor(req), id, dto);
  }

  /* ── admin ── */

  @Get('admin/list')
  @UseGuards(JwtAuthGuard, AdminGuard)
  adminList(@Query() q: Record<string, any>) {
    return this.hotels.adminList(q);
  }

  @Post('admin')
  @UseGuards(JwtAuthGuard, AdminGuard)
  adminCreate(@Request() req, @Body() dto: any) {
    return this.hotels.create(actor(req), dto, { asAdmin: true });
  }

  @Patch('admin/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  adminSet(@Param('id') id: string, @Body() dto: any) {
    return this.hotels.adminSet(id, dto);
  }

  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  adminDelete(@Param('id') id: string) {
    return this.hotels.adminDelete(id);
  }

  @Get('admin/claims')
  @UseGuards(JwtAuthGuard, AdminGuard)
  claims(@Query('status') status?: string) {
    return this.hotels.listClaims(status || 'pending');
  }

  @Patch('admin/claims/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  decideClaim(@Param('id') id: string, @Body() dto: any) {
    return this.hotels.decideClaim(id, dto);
  }
}
