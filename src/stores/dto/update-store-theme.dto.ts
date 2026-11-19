import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsHexColor, IsOptional, IsString, Length } from 'class-validator';

export class UpdateStoreThemeDto {
  @ApiPropertyOptional({ example: '#B07A85' })
  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @ApiPropertyOptional({ example: '#F4A3BA' })
  @IsOptional()
  @IsHexColor()
  accentColor?: string;

  @ApiPropertyOptional({ example: '#FFF1F5' })
  @IsOptional()
  @IsHexColor()
  bgColor?: string;

  @ApiPropertyOptional({ example: 'Playfair Display' })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  fontTitle?: string;

  @ApiPropertyOptional({ example: 'Nunito' })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  fontBody?: string;
}
