import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { StoresService } from './stores.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { UpdateStoreThemeDto } from './dto/update-store-theme.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('stores')
@Controller('stores')
export class StoresController {
  constructor(private storesService: StoresService) {}

  @Get('public/:slug')
  @ApiOperation({ summary: 'Dados públicos da loja' })
  async getPublicStore(@Param('slug') slug: string) {
    return this.storesService.findBySlug(slug);
  }

  // Sem @Roles: qualquer usuário autenticado pode perguntar se tem loja.
  // Quem ainda não tem loja recebe 404 (e não 403), para o painel mostrar o
  // formulário de criação em vez de um erro de permissão.
  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Minha loja (404 quando o usuário ainda não tem loja)' })
  async myStore(@Request() req) {
    return this.storesService.findByOwner(req.user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar lojas (admin)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.storesService.findAll(+page, +limit);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar loja e tornar o usuário owner' })
  async create(@Request() req, @Body() dto: CreateStoreDto) {
    return this.storesService.create(req.user.id, dto);
  }

  @Put('mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STORE_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar minha loja' })
  async update(@Request() req, @Body() dto: UpdateStoreDto) {
    return this.storesService.update(req.user.id, dto);
  }

  @Patch('mine/theme')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STORE_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar o tema da minha loja' })
  async updateTheme(
    @Request() req,
    @Body() dto: UpdateStoreThemeDto,
  ) {
    return this.storesService.updateTheme(req.user.id, dto);
  }
}
