import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Colares' })
  @IsString()
  @Length(2, 80)
  name: string;

  @ApiPropertyOptional({ example: 'colares' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug deve conter apenas letras minúsculas, números e hífens',
  })
  @Length(1, 80)
  slug?: string;
}
