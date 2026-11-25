import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { PackageService } from './package.service';
import { CreatePackageDto, UpdatePackageDto } from '@pakhotels/types/package';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('packages')
export class PackageController {
  constructor(private readonly packageService: PackageService) {}

  @Get()
  async findAll() {
    return this.packageService.findAll();
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async findAllIncludingInactive() {
    return this.packageService.findAllIncludingInactive();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.packageService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async create(@Body() dto: CreatePackageDto) {
    return this.packageService.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async update(@Param('id') id: string, @Body() dto: UpdatePackageDto) {
    return this.packageService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async delete(@Param('id') id: string) {
    return this.packageService.delete(id);
  }

  /** The three PakHotels plans (docs/PRODUCT.md). Matched by name, so running it again updates them in place. */
  @Post('seed')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async seed() {
    const created = await this.packageService.seedHotelPlans();
    return { success: true, message: `Seeded ${created.length} plans`, packages: created };
  }
}
