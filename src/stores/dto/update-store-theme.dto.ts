import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsHexColor, IsOptional } from 'class-validator';
import { OptionalText } from '../../common/decorators/optional-text.decorator';

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
  @OptionalText(1, 80)
  fontTitle?: string;

  @ApiPropertyOptional({ example: 'Nunito' })
  @OptionalText(1, 80)
  fontBody?: string;
}
