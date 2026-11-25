import {
  BadRequestException, Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Request, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { StorageService } from '@pakhotels/storage/storage.service';
import { BookingService } from './booking.service';

const actor = (req: any) => ({ userId: req.user?.userId, role: req.user?.role });

@Controller('bookings')
export class BookingController {
  constructor(
    private readonly bookings: BookingService,
    private readonly storage: StorageService,
  ) {}

  /* ── guest ── */

  /** Booking needs an account (created inside the booking sheet), so every stay is in someone's trips. */
  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle({ short: { limit: 2, ttl: 1000 }, medium: { limit: 10, ttl: 60_000 }, long: { limit: 40, ttl: 3_600_000 } })
  create(@Request() req, @Body() dto: any) {
    return this.bookings.create(dto, req.user);
  }

  @Get('lookup')
  @Throttle({ medium: { limit: 10, ttl: 60_000 } })
  lookup(@Query('ref') ref: string, @Query('phone') phone: string) {
    return this.bookings.lookup(ref, phone);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  my(@Request() req) {
    return this.bookings.mine(req.user.userId);
  }

  @Get('ref/:ref')
  byRef(@Param('ref') ref: string, @Query('t') t: string) {
    return this.bookings.byRef(ref, t);
  }

  @Post('ref/:ref/cancel')
  @HttpCode(200)
  cancel(@Param('ref') ref: string, @Body() dto: any) {
    return this.bookings.cancelByGuest(ref, dto.t, dto.reason);
  }

  /** "I did stay" — after the hotel marked the booking cancelled or no-show. */
  @Post('ref/:ref/stayed')
  @HttpCode(200)
  @Throttle({ medium: { limit: 5, ttl: 60_000 } })
  stayed(@Param('ref') ref: string, @Body() dto: any) {
    return this.bookings.disputeStay(ref, dto.t, dto.note);
  }

  @Post('ref/:ref/advance')
  @HttpCode(200)
  advance(@Param('ref') ref: string, @Body() dto: any) {
    return this.bookings.submitAdvance(ref, dto.t, dto);
  }

  /** Payment screenshot for an advance — the booking's secret is the permission. */
  @Post('ref/:ref/upload')
  @Throttle({ medium: { limit: 6, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }))
  async upload(@Param('ref') ref: string, @Query('t') t: string, @UploadedFile() file: Express.Multer.File) {
    await this.bookings.byRef(ref, t); // 404 unless the secret matches
    if (!file || !/^image\/(jpeg|png|webp|heic|heif)$/.test(file.mimetype)) throw new BadRequestException('Please attach a photo or screenshot (JPG, PNG or WebP).');
    const key = await this.storage.upload(file, `payments/${new Date().getFullYear()}`);
    return { url: this.storage.getUrl(key) };
  }

  @Post('ref/:ref/review')
  @HttpCode(200)
  @Throttle({ medium: { limit: 5, ttl: 60_000 } })
  review(@Param('ref') ref: string, @Body() dto: any) {
    return this.bookings.review(ref, dto.t, dto);
  }

  /* ── hotel (owner) and admin ── */

  @Get('hotel')
  @UseGuards(JwtAuthGuard)
  list(@Request() req, @Query() q: Record<string, any>) {
    return this.bookings.list(actor(req), q);
  }

  @Get('hotel/stats')
  @UseGuards(JwtAuthGuard)
  stats(@Request() req, @Query('hotelId') hotelId?: string) {
    return this.bookings.stats(actor(req), hotelId);
  }

  @Post('hotel')
  @UseGuards(JwtAuthGuard)
  manual(@Request() req, @Body() dto: any, @Query('hotelId') hotelId?: string) {
    return this.bookings.createManual(actor(req), dto, hotelId);
  }

  @Get('hotel/reviews')
  @UseGuards(JwtAuthGuard)
  reviews(@Request() req, @Query('hotelId') hotelId?: string) {
    return this.bookings.hotelReviews(actor(req), hotelId);
  }

  @Patch('reviews/:id/reply')
  @UseGuards(JwtAuthGuard)
  reply(@Request() req, @Param('id') id: string, @Body('reply') reply: string) {
    return this.bookings.replyReview(actor(req), id, reply);
  }

  @Patch('reviews/:id/status')
  @UseGuards(JwtAuthGuard, AdminGuard)
  moderate(@Param('id') id: string, @Body('status') status: string) {
    return this.bookings.moderateReview(id, status);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  setStatus(@Request() req, @Param('id') id: string, @Body() dto: any) {
    return this.bookings.setStatus(actor(req), id, dto);
  }

  @Patch(':id/advance')
  @UseGuards(JwtAuthGuard)
  setAdvance(@Request() req, @Param('id') id: string, @Body() dto: any) {
    return this.bookings.setAdvance(actor(req), id, dto);
  }

  @Patch(':id/note')
  @UseGuards(JwtAuthGuard)
  setNote(@Request() req, @Param('id') id: string, @Body() dto: any) {
    return this.bookings.setNote(actor(req), id, dto);
  }
}
