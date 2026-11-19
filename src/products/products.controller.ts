import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get('public/:storeSlug')
  @ApiOperation({ summary: 'Produtos públicos de uma loja' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'search', required: false })
  async findAllPublic(
    @Param('storeSlug') storeSlug: string,
    @Query('page') page = 1,
    @Query('limit') limit = 12,
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    return this.productsService.findAllPublic(storeSlug, {
      page: +page,
      limit: +limit,
      category,
      search,
    });
  }

  @Get('public/:storeSlug/categories')
  @ApiOperation({ summary: 'Categorias da loja' })
  async getCategories(@Param('storeSlug') storeSlug: string) {
    return this.productsService.findCategories(storeSlug);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STORE_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Produtos da minha loja (inclui inativos)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findMine(
    @Request() req,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.productsService.findByStore(req.user.id, +page, +limit);
  }

  @Get('mine/categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STORE_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Categorias da minha loja' })
  async getMyCategories(@Request() req) {
    return this.productsService.findMyCategories(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe do produto' })
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STORE_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar produto na minha loja' })
  async create(@Request() req, @Body() dto: CreateProductDto) {
    return this.productsService.create(req.user.id, dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STORE_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar produto da minha loja' })
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STORE_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remover produto da minha loja (soft delete)' })
  async remove(@Request() req, @Param('id') id: string) {
    return this.productsService.remove(req.user.id, id);
  }
}
